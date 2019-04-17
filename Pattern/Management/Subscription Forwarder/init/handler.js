function handler() {
    var self = this;
    stream.create().memory("subscriptions").heap().createIndex("id").createIndex("context").createIndex("channelid");

    this.addSubscription = function (context, channelid) {
        var id = context + "-" + channelid;
        var inputs = stream.memory("subscriptions").index("id").get(id);
        if (inputs.size() === 0) {
            stream.create().input(id).management().context(context)
                .onAdd(function (input) {
                    sendToChannel(channelid, input.current());
                })
                .onChange(function (input) {
                    sendToChannel(channelid, input.current());
                })
                .onRemove(function (input) {
                    sendToChannel(channelid, input.current());
                }).start();
            var outputs = stream.memory("subscriptions").index("channelid").get(channelid);
            if (outputs.size() === 0)
                stream.create().output(channelid).queue();
            stream.memory("subscriptions").add(
                stream.create().message().message()
                    .property("id").set(id)
                    .property("context").set(context)
                    .property("channelid").set(channelid)
            )
        }
    };

    this.removeSubscription = function (context, channelid) {
        var id = context + "-" + channelid;
        if (stream.memory("subscriptions").index("id").get(id).size() > 0) {
            stream.memory("subscriptions").index("id").remove(id);
            stream.input(id).close();
            var outputs = stream.memory("subscriptions").index("channelid").get(channelid);
            if (outputs.size() === 0)
                stream.output(channelid).close();
        }
    };

    function sendToChannel(channelid, message) {
        var body = {};
        message.properties().forEach(function (p) {
            body[p.name()] = p.value().toObject();
        });
        var content = JSON.stringify(body);
        var msg = stream.create().message().textMessage().nonpersistent().property("channelid").set(channelid).body(content);
        self.executeOutputLink("Debug", msg);
        if (stream.output(channelid) != null)
            stream.output(channelid).send(msg);
    }
}