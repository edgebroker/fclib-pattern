function handler() {
    var self = this;
    this.cidprop = "__corrid";
    var cid = 0;
    stream.create().input(stream.create().tempQueue(self.compid + "-reply")).queue().onInput(function (input) {
        var correlationId = input.current().correlationId();
        if (correlationId !== null) {
            var mem = stream.memory(self.compid + "-requests").index(self.cidprop).get(correlationId);
            if (mem.size() === 1) {
                var corridValue = mem.first().property(self.props["correlationprop"]).value().toObject();
                stream.memory(self.compid + "-requests").index(self.cidprop).remove(correlationId);
                forwardOutput(corridValue, input.current().body());
            } else
                stream.log().error("Request for correlationid not found: " + input.current());
        } else
            stream.log().error("Received a reply without correlationId: " + input.current());

    });
    stream.create().memory(self.compid + "-requests").heap()
        .createIndex(this.cidprop)
        .limit().time().seconds(self.props["timeout"])
        .onRetire(function (retired) {
            retired.forEach(function (message) {
                self.executeOutputLink("Timeout", message);
            });
        });

    stream.create().timer(self.compid + "-limitcheck").interval().seconds(self.props["timeout"]).onTimer(function (timer) {
        stream.memory(self.compid + "-requests").checkLimit();
    });

    function forwardOutput(correlationId, replyBody) {
        var reply = stream.create().message().textMessage();
        reply.property(self.props["correlationprop"]).set(correlationId);
        var body = JSON.parse(replyBody);
        var output = body.body.message.shift();
        output = output.substring(0, output.length - 1);
        reply.body(body.body.message.length === 1 ? body.body.message[0] : JSON.stringify(body.body.message));
        self.executeOutputLink(output, reply);
    }

    this.nextId = function () {
        if (cid === Number.MAX_VALUE)
            cid = 0;
        return "req-" + (cid++);
    }
}