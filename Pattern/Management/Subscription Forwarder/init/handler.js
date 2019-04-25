function handler() {
    var self = this;
    stream.create().memory(this.compid + "-subscriptions").heap().createIndex("id").createIndex("context").createIndex("channelid");
    stream.create().timer(this.compid + "-checklimit").interval().milliseconds(this.props["flushinterval"]).onTimer(function (timer) {
        stream.memory(self.compid + "-subscriptions").forEach(function (subscription) {
            var mem = stream.memory(subscription.property("id").value().toString());
            if (mem != null)
                mem.checkLimit();
        })
    });

    this.addSubscription = function (context, channelid) {
        var id = context + "-" + channelid;
        var inputs = stream.memory(this.compid + "-subscriptions").index("id").get(id);
        if (inputs.size() === 0) {
            stream.create().memory(id).heap()
                .limit()
                .count(500)
                .limit()
                .time()
                .milliseconds(self.props["flushinterval"])
                .tumbling()
                .onRetire(function (retired) {
                    flush(channelid, retired);
                });
            stream.create().input(id).management().context(context)
                .onAdd(function (input) {
                    if (!isFiltered(input.current()))
                        sendToChannel(channelid, input.current());
                })
                .onChange(function (input) {
                    if (isLiveData(input.current()))
                        stream.memory(id).add(input.current());
                    else
                        sendToChannel(channelid, input.current());
                })
                .onRemove(function (input) {
                    if (!isFiltered(input.current()))
                        sendToChannel(channelid, input.current());
                }).start();
            var outputs = stream.memory(this.compid + "-subscriptions").index("channelid").get(channelid);
            if (outputs.size() === 0)
                stream.create().output(channelid).queue();
            stream.memory(this.compid + "-subscriptions").add(
                stream.create().message().message()
                    .property("id").set(id)
                    .property("context").set(context)
                    .property("channelid").set(channelid)
            )
        }
    };

    this.removeSubscription = function (context, channelid) {
        var id = context + "-" + channelid;
        if (stream.memory(this.compid + "-subscriptions").index("id").get(id).size() > 0) {
            stream.memory(this.compid + "-subscriptions").index("id").remove(id);
            stream.input(id).close();
            var outputs = stream.memory(this.compid + "-subscriptions").index("channelid").get(channelid);
            if (outputs.size() === 0)
                stream.output(channelid).close();
            stream.memory(id).close();
        }
    };

    function isFiltered(message) {
        var ctx = message.property("_CTX").value().toString();
        var name = message.property("name").value().toString();
        return ctx === "/sys$queuemanager/usage" && name.startsWith("tpc$");
    }

    function isLiveData(message) {
        var ctx = message.property("_CTX").value().toString();
        return ctx.indexOf("/usage") !== -1;
    }

    function flush(channelid, memory) {
        var bulk = [];
        memory.group("name").forEach(function (groupmem) {
            var event = groupmem.first();
            groupmem.forEach(function (msg) {
                msg.properties().forEach(function (prop) {
                    var name = prop.name();
                    var value = prop.value().toObject();
                    if (!(name === "_CTX" || name === "_TIME" || name === "_OP"))
                        event.property(name).set(value);
                })
            });
            var body = {};
            event.properties().forEach(function (p) {
                body[p.name()] = p.value().toObject();
            });
            var content = JSON.stringify(body);
            bulk.push(content);
        });
        sendBulk(channelid, bulk);
    }

    function sendBulk(channelid, bulk) {
        var body = {
            _OP: "bulk",
            _CONTENT: bulk
        };
        var msg = stream.create().message().textMessage().nonpersistent().property("channelid").set(channelid).body(JSON.stringify(body));
        self.executeOutputLink("Debug", msg);
        if (stream.output(channelid) != null)
            stream.output(channelid).send(msg);
    }

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