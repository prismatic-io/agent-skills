# Message extraction handover

The supplied Python program takes a complete message file and an output directory:
`python3 email-unpack.py -d output message.eml`. The source runtime is Python 3.11.2.
`example.eml` is an ordinary incoming message. There are no production accounts
or deployment operations in this task.

The new boundary is callable extraction. Our existing caller owns the destination
and applies returned items in order, replacing earlier content when a name repeats.
It can supply full message bytes and consume binary-safe decoded bytes. Choose and
document a usable representation; do not lose binary data through text conversion.
Return names and bytes for all extracted non-container content parts, including
unnamed parts, rather than only parts labelled as attachments.

Return an explicit unsuccessful outcome with the successfully extracted prefix
if extraction fails. The caller applies that prefix and reports the failure.
We authorize delaying writes until the result arrives and omitting a destination
that was only created/truncated before a failed payload write. Local directory
creation and exact Python traceback wording are not required. Destination write
failures remain our caller's responsibility. Do not add a storage service.

Intake supplies trusted filenames: single basenames, without slash, backslash or
NUL. Exact names `.` and `..` are excluded; ordinary dots/extensions are allowed.
You may reject names outside that domain. No other renaming, filtering or parsing
simplification has been approved.

The source parser uses the explicit default email policy. Its MIME extension
lookup uses Python's mimetypes data, which can depend on runtime/OS configuration;
explain unresolved compatibility rather than claiming every platform is identical.
The supplied runtime uses .txt for text/plain; unknown types fall back to .bin.
The source code remains the reference for traversal, naming, decoding and failures
within this extraction boundary. Keep live sending and storage out of this work.
