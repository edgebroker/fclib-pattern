function handler() {
    var self = this;

    stream.create().memory(this.compid + "-contexts").heap().createIndex("context");
    stream.create().memory(this.compid + "-subscriptions").heap().createIndex("context").createIndex("channelid");

    stream.create().timer(this.compid + "-flusher").interval().milliseconds(this.props["flushinterval"]).onTimer(function (timer) {
        stream.memory(self.compid + "-contexts").forEach(function (ctx) {
            var context = ctx.property("context").value().toString();
            var contextMem = stream.memory(self.compid+context);
            flush(context, contextMem);
            contextMem.clear();
        })
    });

    this.addSubscription = function (context, channelid) {
        var inputs = stream.memory(self.compid + "-contexts").index("context").get(context);
        if (inputs.size() === 0) {
            stream.create().input(context).management().context(context)
                .onAdd(function (input) {
                    if (!isFiltered(input.current())) {
                        addToImage(context, input.current());
                        sendToChannels(context, input.current());
                    }
                })
                .onChange(function (input) {
                    if (!isFiltered(input.current())){
                        updateImage(context, input.current());
                        if (isLiveData(input.current()))
                            stream.memory(self.compid+context).add(input.current());
                        else
                            sendToChannels(context, input.current());
                    }
                })
                .onRemove(function (input) {
                    if (!isFiltered(input.current())) {
                        removeFromImage(context, input.current());
                        sendToChannels(context, input.current());
                    }
                }).start();
            stream.create().memory(self.compid + "-image-"+ context).heap().createIndex("name");
            stream.create().memory(self.compid + context).heap().createIndex("name");
            stream.memory(this.compid + "-contexts").add(
                stream.create().message().message()
                    .property("context").set(context)
            );
        }
        var outputs = stream.memory(self.compid + "-subscriptions").index("channelid").get(channelid);
        if (outputs.size() === 0) {
            stream.create().output(channelid).queue();
        }
        if (stream.memory(self.compid + "-subscriptions").index("context").get(context).size() > 0)
            flushImage(context, channelid);
        stream.memory(this.compid + "-subscriptions").add(
            stream.create().message().message()
                .property("channelid").set(channelid)
                .property("context").set(context)
        );
    };

    this.removeSubscription = function (context, channelid) {
        stream.memory(self.compid + "-subscriptions").remove("context = '" + context + "' and channelid = '" + channelid + "'");
        var outputs = stream.memory(self.compid + "-subscriptions").index("channelid").get(channelid);
        if (outputs.size() === 0)
            stream.output(channelid).close();
        var subs = stream.memory(self.compid + "-subscriptions").index("context").get(context);
        if (subs.size() === 0) {
            stream.input(context).close();
            stream.memory(self.compid + "-contexts").index("context").remove(context);
            stream.memory(self.compid + context).close();
            stream.memory(self.compid + "-image-"+ context).close();
        }
    };

    function addToImage(context, message){
        stream.memory(self.compid + "-image-"+ context).add(message);
        stream.log().info("addToImage: "+stream.memory(self.compid + "-image-"+ context).size());
    }

    function removeFromImage(context, message) {
        stream.memory(self.compid + "-image-"+ context).index("name").remove(message.property("name").value().toString());
        stream.log().info("removeFromImage: "+stream.memory(self.compid + "-image-"+ context).size());
    }

    function updateImage(context, message) {
        var images = stream.memory(self.compid + "-image-"+ context).index("name").get(message.property("name").value().toString());
        if (images.size() === 1){
            var image = images.first();
            message.properties().forEach(function(prop){
                var name = prop.name();
                if (!(name === "_CTX" || name === "_TIME" || name === "_OP"))
                    image.property(name).set(prop.value());
            });
            stream.log().info("updateImage: "+stream.memory(self.compid + "-image-"+ context).size());
        }
    }

    function flushImage(context, channelid) {
        var bulk = [];
        stream.memory(self.compid + "-image-"+ context).forEach(function(msg){
            var body = {};
            msg.properties().forEach(function (p) {
                body[p.name()] = p.value().toObject();
            });
            var content = JSON.stringify(body);
            bulk.push(content);
        });
        stream.log().info("flushImage: "+JSON.stringify(bulk));
        if (bulk.length > 0) {
            var body = {
                _OP: "bulk",
                _CONTENT: bulk
            };
            var msg = stream.create().message().textMessage().nonpersistent().property("channelid").set(channelid).body(JSON.stringify(body));
            self.executeOutputLink("Debug", msg);
            stream.output(channelid).send(msg);
        }
    }

    function isFiltered(message) {
        var ctx = message.property("_CTX").value().toString();
        var name = message.property("name").value().toString();
        return ctx === "/sys$queuemanager/usage" && name.startsWith("tpc$");
    }

    function isLiveData(message) {
        var ctx = message.property("_CTX").value().toString();
        return ctx.indexOf("/usage") !== -1;
    }

    function flush(context, memory) {
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
        if (bulk.length > 0)
            sendBulk(context, bulk);
    }

    function sendBulk(context, bulk) {
        var body = {
            _OP: "bulk",
            _CONTENT: bulk
        };
        stream.memory(self.compid+"-subscriptions").index("context").get(context).forEach(function(sub){
            var channelid = sub.property("channelid").value().toString();
            var msg = stream.create().message().textMessage().nonpersistent().property("channelid").set(channelid).body(JSON.stringify(body));
            self.executeOutputLink("Debug", msg);
            if (stream.output(channelid) != null)
                stream.output(channelid).send(msg);
        });
    }

    function sendToChannels(context, message){
        stream.memory(self.compid+"-subscriptions").index("context").get(context).forEach(function(sub){
            sendToChannel(sub.property("channelid").value().toString(), message);
        })
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