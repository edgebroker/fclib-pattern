function handler() {
    var self = this;
    stream.create().input(stream.create().tempQueue(self.compid + "-reply")).queue().onInput(function (input) {
        var correlationId = input.current().correlationId();
        if (correlationId !== null) {
            var mem = stream.memory(self.compid + "-requests").index(self.props["correlationprop"]).get(correlationId);
            if (mem.size() > 0) {
                stream.memory(self.compid + "-requests").index(self.props["correlationprop"]).remove(correlationId);
                self.executeOutputLink("Reply", forwardOutput(correlationId, input.current()));
            } else
                stream.log().error("Request for correlationid not found: " + input.current());
        } else
            stream.log().error("Received a reply without correlationId: " + input.current());

    });
    stream.create().memory(self.compid + "-requests").heap()
        .createIndex(this.props["correlationprop"])
        .limit().time().seconds(self.props["timeout"])
        .onRetire(function (retired) {
            retired.forEach(function (message) {
                self.executeOutputLink("Timeout", message);
            });
        });

    stream.create().timer(self.compid + "-limitcheck").interval().seconds(self.props["timeout"]).onTimer(function (timer) {
        stream.memory(self.compid + "-requests").checkLimit();
    });

    function forwardOutput(correlationId, reply) {
        reply.property(self.props["correlationprop"]).set(correlationId);
        var body = JSON.parse(reply.body());
        var output = body.body.message.shift();
        output = output.substring(0, output.length - 1);
        reply.body(JSON.stringify(body.body.message));
        stream.log().info("Send reply: " + output + "/" + reply);
        self.executeOutputLink(output, reply);
    }
}