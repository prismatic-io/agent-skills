/**
 * MuleSoft Examples
 * Copyright 2014 MuleSoft, Inc.
 *
 * This product includes software developed at
 * MuleSoft, Inc. (http://www.mulesoft.com/).
 */

package org.mule.examples;

import static org.junit.Assert.assertEquals;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.junit.Rule;
import org.junit.Test;
import org.mule.DefaultMuleMessage;
import org.mule.api.MuleMessage;
import org.mule.api.config.MuleProperties;
import org.mule.module.client.MuleClient;
import org.mule.tck.junit4.FunctionalTestCase;
import org.mule.tck.junit4.rule.DynamicPort;
import org.mule.util.IOUtils;

public class ProcessingOrdersWithDataweaveAndApikitIT extends FunctionalTestCase
{
	private static final Logger log = LogManager.getLogger(ProcessingOrdersWithDataweaveAndApikitIT.class); 
	
	@Rule
	public DynamicPort port = new DynamicPort("http.port");
	
    @Override
    protected String getConfigResources()
    {
        return "./src/main/app/books.xml,./src/main/app/currency.xml";
    }
    
    @Override
	protected Properties getStartUpProperties() {
		Properties properties = new Properties(super.getStartUpProperties());
		properties.put(MuleProperties.APP_HOME_DIRECTORY_PROPERTY,
				"./src/main/api/");
		return properties;
	}	
    
    @Test
    public void processOrders() throws Exception
    {
        MuleClient client = new MuleClient(muleContext);
        String fileInputPath = "file://./src/main/resources/input";
        Map<String, Object> outboundProperties = new HashMap<String, Object>();
        outboundProperties.put("outputPattern", "orders.xml");
        MuleMessage message = new DefaultMuleMessage(
        		IOUtils.getResourceAsString("orders.xml", this.getClass()),
        		outboundProperties,
        		muleContext);
        log.info("Testing application");
        client.dispatch(fileInputPath, message);
        
        Thread.sleep(5000);
        
        log.info("Reading resulting files");
        String resultFileOrdersOutput = FileUtils.readFileToString(new File("./src/main/resources/output/orders.json"));
        String resultFileReportOutput = FileUtils.readFileToString(new File("./src/main/resources/output/report.csv"));
        
        log.info("Reading expected result files");
        String expectedFileOrdersOutput = IOUtils.getResourceAsString("orders.json", this.getClass());
        String expectedFileReportOutput = IOUtils.getResourceAsString("report.csv", this.getClass());
        
        assertEquals(expectedFileOrdersOutput.replaceAll("\\s", ""), resultFileOrdersOutput.replaceAll("\\s", ""));
        assertEquals(expectedFileReportOutput.replaceAll("\\s", ""), resultFileReportOutput.replaceAll("\\s", ""));
	}
}
