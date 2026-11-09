function handler() {
    var self = this;
    var methods = this.props["methods"];

    this.setOutputReference("Request", execRef);

    function execRef() {
        return self.request;
    }

    stream.create().input(this.compid).topic()
        .destinationName(this.props["topic"])
        .onInput(function (input) {
            var request = input.current();
            try {
                handleRequest(request);
            } catch (e) {
                // Whatever went wrong here or downstream, the client must not wait forever.
                // If the flow has answered already, the server discards this second reply.
                reply(request, 500, "Internal server error.");
                self.flowcontext.sendError(self.compname, self.compid, "Exception while handling REST request: " + e);
            }
        });

    function handleRequest(request) {
        var method = connectorOf(request.property("operation").exists() ? request.property("operation").value().toString() : "");
        if (method === null) {
            reply(request, 405, "Method not allowed.");
            return;
        }
        var body = parseBody(request);
        if (body === null) {
            reply(request, 400, "Request body must be a JSON object.");
            return;
        }
        copyParams(request, body["_params"]);
        self.request = request;
        self.executeOutputLink(method, request);
    }

    // Returns the configured method (= name of the output connector) that matches the request's method, or null.
    function connectorOf(operation) {
        for (var i = 0; i < methods.length; i++) {
            if (methods[i].trim().toUpperCase() === operation.toUpperCase())
                return methods[i];
        }
        return null;
    }

    // Returns the parsed body if it is a JSON object, null otherwise.
    function parseBody(request) {
        if (request.type() !== "text")
            return null;
        try {
            var body = JSON.parse(request.body());
            return body !== null && typeof body === "object" && !Array.isArray(body) ? body : null;
        } catch (e) {
            return null;
        }
    }

    // _params holds the path and query parameters. Properties set by the server (operation, requesttype,
    // restrequest) are never overwritten, and a parameter whose name is not a valid property name is skipped
    // instead of failing the whole request.
    function copyParams(request, params) {
        if (params === null || typeof params !== "object")
            return;
        for (var name in params) {
            var value = params[name];
            if (value === null || value === undefined || request.property(name).exists())
                continue;
            try {
                request.property(name).set(typeof value === "object" ? JSON.stringify(value) : String(value));
            } catch (e) {
                stream.log().info("REST Route '" + self.compname + "': skipping parameter '" + name + "': " + e);
            }
        }
    }

    function reply(request, status, message) {
        try {
            if (request.replyTo() === null) {
                stream.log().error("REST Route '" + self.compname + "': cannot answer request without replyTo (status " + status + ")");
                return;
            }
            var msg = stream.create().message().textMessage().nonpersistent()
                .body(JSON.stringify({_http_status: status, error: message}));
            msg.correlationId(request.correlationId());
            stream.create().output(null).forAddress(request.replyTo()).send(msg).close();
        } catch (e) {
            stream.log().error("REST Route '" + self.compname + "': unable to send reply (status " + status + "): " + e);
        }
    }
}
