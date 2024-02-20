# ServiceNow LogicMonitor Push Connector

A better [Push Connector](https://docs.servicenow.com/csh?topicname=configure-listener-transform-script.html&version=latest) for [LogicMonitor](https://www.logicmonitor.com/support) integration with ServiceNow Event Management. It handles all standard LogicMonitor alert types including Website alerts. The event field mappings broadly follow the definitions set out in the [web service API](https://docs.servicenow.com/csh?topicname=send-events-via-web-service.html&version=latest) documentation.

## Setup

1. Ensure the following plugins are active as a minimum requirement.
    - Event Management and Service Mapping Core (`com.snc.service-watch`).
    - Event Management (`com.glideapp.itom.snac`).
    - Event Management Connectors (`sn_em_connector`)

2. Import the update set file [`logicmonitor_plus_connector.xml`](logicmonitor_plus_connector.xml) using the "Retrieved Update Sets" option within ServiceNow. The following records will be created:
    - The push connector `LogicMontor Plus`.

## Usage

Create a [Custom HTTP Delivery](https://www.logicmonitor.com/support/alerts/integrations/custom-http-delivery) integration in LogicMonitor with the following required settings.
* HTTP Method `POST`.
* URL `https://<TENANT_NAME>.service-now.com/api/sn_em_connector/em/inbound_event?source=lmp`. The additional parameter `event_class` is supported and will map to the `Source instance` event field. For example append `&event_class=sandbox` to identify events from a LogicMonitor sandbox test environment.
* Username and Password of a ServiceNow user with the `evt_mgmt_integration` role.
* Alert Data in the following JSON format:
```json
{
    "host": "##HOST##",
    "hostname": "##HOSTNAME##",
    "website": "##WEBSITE##",
    "agentid": "##AGENTID##",
    "internalid": "##INTERNALID##",
    "alertid" : "##ALERTID##",
    "alerttype": "##ALERTTYPE##",
    "alertstatus": "##ALERTSTATUS##",
    "level": "##LEVEL##",
    "datasource": "##DATASOURCE##",
    "dsname": "##DSNAME##",
    "instance": "##INSTANCE##",
    "datapoint": "##DATAPOINT##",
    "value": "##VALUE##",
    "date" : "##DATE##",
    "start": "##START##",
    "duration": "##DURATION##",
    "end": "##END##",
    "threshold": "##THRESHOLD##",
    "message" : "##MESSAGE##",
    "hostgroup": "##HOSTGROUP##",
    "wineventid": "##EVENTCODE##",
    "webcheckurl": "##URL##"
}
```
> [!IMPORTANT]
> To avoid issues with parsing certain time zones the `GMT (No daylight saving)` zone should be set under [Account Information](https://www.logicmonitor.com/support/settings/account-information/portal-settings) in LogicMonitor. LogicMonitor uses an [abbreviated time zone](https://en.wikipedia.org/wiki/List_of_time_zone_abbreviations) string for the [tokens](https://www.logicmonitor.com/support/logicmodules/about-logicmodules/tokens-available-in-datasource-alert-messages) used in the alert data. Common abbreviated zones such as `BST` and `CST` are not unique and will cause an error in the push connector script.
