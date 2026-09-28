#!/usr/bin/env python3
"""Offline source-fixture and output checks. Does not execute Mule or a target."""
import argparse
import csv
import hashlib
import json
import re
from decimal import Decimal
from pathlib import Path
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'input' / 'source' / 'processing-orders-with-dataweave-and-APIkit'
EXPECTED = ROOT / 'expected'


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise AssertionError(f'duplicate JSON key: {key}')
        result[key] = value
    return result


def invalid_number(value):
    raise AssertionError(f'non-JSON numeric constant: {value}')


def read_json(path):
    return json.loads(Path(path).read_text(), parse_float=Decimal,
                      parse_int=Decimal, parse_constant=invalid_number,
                      object_pairs_hook=unique_object)


def same_json(actual, expected, path='$'):
    assert type(actual) is type(expected), f'{path}: JSON type differs'
    if isinstance(expected, dict):
        assert actual.keys() == expected.keys(), f'{path}: fields differ'
        for key in expected:
            same_json(actual[key], expected[key], f'{path}.{key}')
    elif isinstance(expected, list):
        assert len(actual) == len(expected), f'{path}: array length differs'
        for index, (a, e) in enumerate(zip(actual, expected)):
            same_json(a, e, f'{path}[{index}]')
    else:
        assert actual == expected, f'{path}: value differs'


def read_csv(path):
    with Path(path).open(newline='') as stream:
        return list(csv.reader(stream, strict=True))


def compare(orders, report):
    same_json(read_json(orders), read_json(EXPECTED / 'orders.json'))
    actual, expected = read_csv(report), read_csv(EXPECTED / 'report.csv')
    assert len(actual) == len(expected), 'CSV row count differs'
    assert actual[0] == expected[0], 'CSV header or column order differs'
    for row_index, (a, e) in enumerate(zip(actual[1:], expected[1:]), 1):
        assert len(a) == len(e), f'CSV row {row_index}: column count differs'
        for index, (cell, wanted) in enumerate(zip(a, e)):
            assert cell == cell.strip(), f'CSV row {row_index}: added cell whitespace'
            assert re.fullmatch(r'[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?', cell), (
                f'CSV row {row_index}: unsupported decimal spelling')
            number = Decimal(cell)
            assert number.is_finite() and number == Decimal(wanted), (
                f'CSV row {row_index} column {index}: value differs')


def verify_source():
    manifest = json.loads((ROOT / 'source-files.json').read_text())
    for file in manifest:
        data = (ROOT / 'input' / 'source' / file['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == file['sha256'], file['path']
    for name in ('orders.json', 'report.csv'):
        assert (EXPECTED / name).read_bytes() == (
            SOURCE / 'src/main/resources' / name).read_bytes(), name
    items = ET.parse(SOURCE / 'src/main/resources/orders.xml').getroot().findall('item')
    amounts = [Decimal(item.findtext('price')) for item in items]
    report = read_csv(EXPECTED / 'report.csv')
    assert report[0] == ['totalNumberOfItems', 'totalAmount', 'averageSellingPrice']
    assert [Decimal(x) for x in report[1]] == [
        Decimal(len(items)), sum(amounts), sum(amounts) / len(items)]
    selected = [item for item in items if int(item.findtext('properties/year')) > 2004]
    output = read_json(EXPECTED / 'orders.json')['orders']
    assert [x['title'] for x in output] == [x.findtext('properties/title') for x in selected]
    rates = read_json(SOURCE / 'src/main/resources/currency.json')['USD']
    for item, order in zip(selected, output):
        assert order['prices'] == [
            {'price': rate['ratio'] * Decimal(item.findtext('price')),
             'currency': rate['currency']} for rate in rates]
    compare(EXPECTED / 'orders.json', EXPECTED / 'report.csv')
    return {'source_files_verified': len(manifest),
            'sample_orders': len(items), 'sample_output_orders': len(output),
            'native_runtime_executed': False,
            'evidence': 'upstream fixtures plus independent sample consistency checks'}


def self_test():
    compare(EXPECTED / 'orders.json', EXPECTED / 'report.csv')
    rejected = []
    with tempfile.TemporaryDirectory(dir=ROOT) as directory:
        directory = Path(directory)
        source = json.loads((EXPECTED / 'orders.json').read_text())
        for name in ('missing-order', 'changed-title-whitespace', 'string-price', 'wrong-report', 'underscore-decimal'):
            data = json.loads(json.dumps(source))
            report = (EXPECTED / 'report.csv').read_text()
            if name == 'missing-order':
                data['orders'].pop()
            elif name == 'changed-title-whitespace':
                data['orders'][0]['title'] = 'Everyday  Italian'
            elif name == 'string-price':
                data['orders'][0]['prices'][0]['price'] = '27.60'
            elif name == 'underscore-decimal':
                report = report.replace('149.93', '1_49.93')
            else:
                report = report.replace('4,149.93,37.4825', '2,59.99,29.995')
            (directory / 'orders.json').write_text(json.dumps(data))
            (directory / 'report.csv').write_text(report)
            try:
                compare(directory / 'orders.json', directory / 'report.csv')
            except AssertionError:
                rejected.append(name)
            else:
                raise AssertionError(f'comparator accepted mutation: {name}')
        (directory / 'orders.json').write_text(json.dumps(source))
        (directory / 'report.csv').write_bytes(
            b'totalNumberOfItems,totalAmount,averageSellingPrice\r\n4e0,1.4993e2,3.74825e1\r\n')
        compare(directory / 'orders.json', directory / 'report.csv')
    return {'accepted': ['upstream expected sample', 'equivalent numeric and newline formatting'], 'rejected_mutations': rejected,
            'target_or_source_runtime_executed': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('verify-source')
    commands.add_parser('self-test')
    comparator = commands.add_parser('compare')
    comparator.add_argument('--orders', required=True, type=Path)
    comparator.add_argument('--report', required=True, type=Path)
    args = parser.parse_args()
    if args.command == 'verify-source':
        result = verify_source()
    elif args.command == 'self-test':
        result = self_test()
    else:
        compare(args.orders, args.report)
        result = {'sample_output_comparison': 'passed', 'general_parity_established': False}
    print(json.dumps(result, indent=2))
