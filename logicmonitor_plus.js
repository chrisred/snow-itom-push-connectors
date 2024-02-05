(function process(/*RESTAPIRequest*/ request, body){
    //gs.debug('[MPC] Query String: {0} Headers: {1}', request.queryString, JSON.stringify(request.headers));
    //gs.debug('[MPC] Body: {0}', body);

    try
    {
        var requestBody = JSON.parse(body);
        if (isEmpty(requestBody))
        {
            status = 400;
            return 'No events found in the request body.';
        }

        var eventRecord = new GlideRecord('em_event');
        eventRecord.initialize();

        var eventClass = request.queryParams.event_class;
        eventRecord.source = source_label;
        eventRecord.event_class = (eventClass === undefined) ? source_label : eventClass.toString();

        var resource = (requestBody.website) ? requestBody.website : requestBody.datasource;
        var moduleName = (requestBody.dsname) ? requestBody.dsname : resource;
        var webcheckHost = parseWebcheckUrl(requestBody.webcheckurl);

        eventRecord.node = (webcheckHost) ? webcheckHost : requestBody.host;
        eventRecord.resource = resource;
        eventRecord.metric_name = (requestBody.datapoint) ? moduleName+'-'+requestBody.datapoint : '';
        eventRecord.type = requestBody.alerttype;
        eventRecord.message_key = requestBody.alertid;
        var severity = requestBody.level;
        var alertStatus = requestBody.alertstatus;

        switch (severity)
        {
            case 'critical':
                eventRecord.severity = '1';
                break;
            case 'error':
                eventRecord.severity = '2';
                break;
            case 'warn':
                eventRecord.severity = '3';
                break;
            default:
                eventRecord.severity = '3';
        }

        if (alertStatus == 'clear')
        {
            eventRecord.resolution_state = 'Closing';
            eventRecord.severity = '0';
        }
        
        if (alertStatus == 'ack')
        {
            // set acknowledged alerts to severity 5, "OK"
            eventRecord.severity = '5';
        }

        eventRecord.description = requestBody.message;
        var eventTimeStamp;
        var dateString;
        var eventDate;

        if (requestBody.date)
        {
            // use the "date" property if it is populated
            dateString = parseEventDate(requestBody.date);

            // use Date rather than Date.parse(), parse has some odd behaviour with strings including a time zone offset
            eventDate = new Date(dateString);
            eventTimeStamp = eventDate.getTime();
        }
        else if (requestBody.end)
        {
            // check for "end" if there is no date
            dateString = parseEventDate(requestBody.end);
            eventDate = new Date(dateString);
            eventTimeStamp = eventDate.getTime();
        }
        else
        {
            // Use "start + duration" if date and end are not populated (e.g. for website alerts), this is only
            // accurate to 1 minute.
            var startString = parseEventDate(requestBody.start);
            var eventStart = new Date(startString);
            var eventDuration = getEventDuration(requestBody.duration);
            eventTimeStamp = eventStart.getTime() + eventDuration;
        }

        if (!isNaN(eventTimeStamp))
        {
            var glideEventDate = new GlideDateTime();
            glideEventDate.setNumericValue(eventTimeStamp);
            eventRecord.time_of_event = glideEventDate;
        }
        else
        {
            throw new Error('Error parsing event date or duration, this could be due to an abbreviated time zone like BST or an unexpected format.');
        }

        var additionalInfo = requestBody;

        // populate additional_info field with request params
        var endpointParamsUtil = new EndpointParamsUtil();
        endpointParamsUtil.updateAdditionalInfoWithEndpointParams(request.queryParams, additionalInfo);

        // populate additional_info field with connector_tags
        if (typeof connector_tags !== undefined && connector_tags)
        {
            var pushConnectorInstanceUtils = new PushConnectorInstanceUtils();
            pushConnectorInstanceUtils.updateAdditionalInfoWithConnectorTags(additionalInfo, connector_tags);
        }

        // populate custom domain info
		new sn_em_connector.PushConnectorUtil().populateDomain(sys_id, request, requestBody, eventRecord);

        eventRecord.additional_info = JSON.stringify(additionalInfo);

        var responseBody = {};
        responseBody.eventSysIds = [];
        responseBody.eventSysIds.push(eventRecord.insert());
        response.setBody(responseBody);

        return 'success';
    }
    catch (err)
    {
        gs.error(err.message);
        status = 500;
        return err.message;
    }
})(request, body);

function isEmpty(obj)
{
    for (var prop in obj)
    {
        if (Object.prototype.hasOwnProperty.call(obj, prop))
        {
            return false;
        }
    }
    return true;
}

function parseEventDate(dateString)
{
    // LogicMonitor uses an abbreviated time zone for date strings, and strangely doesn't provide a UTC/GMT token
    // that can be used in the event payload. This means that an ambiguous zone like BST will fail to parse, the
    // UTC or GMT zone should be set at the LogicMonitor account level to ensure the date string can be parsed.
    var match = dateString.match(/^(\d{4}-\d\d-\d\d)\s(.*)/);

    if (match)
    {
        // replace 1970-01-01 to 1970/01/01 and return full time stamp string
        return match[1].replaceAll('-', '/') + ' ' + match[2];
    }
    else
    {
        return '';
    }
}

function getEventDuration(durationString)
{
    // get duration in milliseconds
    var match = durationString.match(/^(\d+)h (\d+)m/);

    if (match)
    {
        var minutes = (parseInt(match[1]) * 60) + parseInt(match[2]);
        return minutes * 60 * 1000;
    }
    else
    {
        return NaN;
    }
}

function parseWebcheckUrl(urlString)
{
    // Match the domain, port, path and params from the URL, doesn't cover every valid URI but should include any that
    // are used in a WebCheck monitor. If ES6+ script mode is enabled the "URL API" could be used instead.
    var match = urlString.match(/^(?:\w+\:\/\/)?([^\/?#:]+):?([^\/?#:]*)([^\?]*)\??(.*)$/);

    // return the domain section of the URI
    return (match) ? match[1] : '';
}
