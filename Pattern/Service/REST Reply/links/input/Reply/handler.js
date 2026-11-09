function handler(Reply) {
    var self = this;
    var label = this.compname + " (" + this.compid + "): ";

    // Must never throw: a request without an answer stays open until the client gives up.
    try {
        var headers = resolveHeaders();
        if (headers.replyTo == null) {
            logError("Cannot answer the request, the message has no ReplyTo and the Request reference holds no request with a ReplyTo.");
            return;
        }
        var result;
        try {
            result = buildResult();
        } catch (e) {
            logError("Exception building the reply: " + e);
            result = {error: "Internal error: " + e, _http_status: 500};
        }
        send(headers, result);
    } catch (e) {
        logError("Exception sending the reply: " + e);
    }

    // The message's own headers win; the Request reference (latest request only) is used when the
    // branch has created a new message. ReplyTo and CorrelationID are taken as a pair from one source so
    // a reply is never addressed to one request with the correlation id of another.
    function resolveHeaders() {
        var replyTo = Reply.replyTo();
        if (replyTo != null)
            return {replyTo: replyTo, correlationId: Reply.correlationId()};
        var ref = self.getInputReference("Request");
        var request = typeof ref === "function" ? ref() : null;
        if (request == null)
            return {replyTo: null, correlationId: null};
        return {replyTo: request.replyTo(), correlationId: request.correlationId()};
    }

    // The server only answers JSON objects; anything else would leave the request open.
    function buildResult() {
        var status = configuredStatus();
        var raw = self.props["raw"] === true || self.props["raw"] === "true";
        var errorText = errorOf();
        var source;
        if (errorText !== null) {
            source = {text: errorText, json: {error: errorText}};
            if (status === 200)
                status = 400;
        } else if (self.props["bodyproperty"]) {
            source = fromProperty(self.props["bodyproperty"]);
            if (source === null) {
                errorText = "Body property '" + self.props["bodyproperty"] + "' does not exist in the message";
                logError(errorText);
                source = {text: errorText, json: {error: errorText}};
                status = 500;
            }
        } else
            source = fromBody();

        var result = source.json;
        if (raw && typeof result.raw !== "string")
            result = {raw: source.text};
        // A status set by the flow in the body (e.g. a Set Text Body template) is kept unless the
        // component is configured with a non-default status.
        if (status !== 200 || typeof result._http_status !== "number")
            result._http_status = status;
        if (raw)
            result._israw = true;
        return result;
    }

    function configuredStatus() {
        var status = parseInt(self.props["status"], 10);
        if (isNaN(status))
            return 200;
        if (status < 100 || status > 599) {
            logError("Invalid status " + self.props["status"] + ", using 500");
            return 500;
        }
        return status;
    }

    // A fixed 'error' property overrides the message property named by 'errorproperty'.
    function errorOf() {
        if (self.props["error"])
            return String(self.props["error"]);
        var name = self.props["errorproperty"] ? self.props["errorproperty"] : "error";
        var prop = Reply.property(name);
        if (prop.exists() && prop.value().toObject() !== null)
            return String(prop.value().toString());
        return null;
    }

    function fromProperty(name) {
        var prop = Reply.property(name);
        if (!prop.exists() || prop.value().toObject() === null)
            return null;
        return parse(String(prop.value().toString()));
    }

    function fromBody() {
        if (Reply.type() !== "text")
            return {text: "", json: {}};
        var body = Reply.body();
        return parse(body == null ? "" : String(body));
    }

    // Empty text gives {}; invalid JSON and JSON that is not an object are wrapped as {"result": ...}.
    function parse(text) {
        if (text.trim().length === 0)
            return {text: text, json: {}};
        var value;
        try {
            value = JSON.parse(text);
        } catch (e) {
            return {text: text, json: {result: text}};
        }
        if (value === null || typeof value !== "object" || Array.isArray(value))
            return {text: text, json: {result: value}};
        return {text: text, json: value};
    }

    function send(headers, result) {
        var reply = stream.create().message().textMessage();
        reply.replyTo(headers.replyTo);
        if (headers.correlationId != null)
            reply.correlationId(headers.correlationId);
        reply.body(JSON.stringify(result));
        var out = stream.create().output(null).forAddress(headers.replyTo);
        try {
            out.send(reply);
        } finally {
            out.close();
        }
    }

    function logError(text) {
        try {
            stream.log().error(label + text);
        } catch (e) {
        }
    }
}
