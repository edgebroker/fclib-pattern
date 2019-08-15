function handler(In) {
    if (!this.assertProperty(In, this.props["correlationprop"]))
        return;
    stream.memory(this.compid + "-requests").add(In);
    var request = stream.create().message().textMessage();
    request.replyTo(stream.tempQueue(this.compid + "-reply").destination());
    request.correlationId(In.property(this.props["correlationprop"]).value().toObject());
    request.property("streamdata").set(true);
    request.property("streamname").set(this.shellstream);
    request.property("commandrequest").set(true);
    request.property("command").set(this.props["command"]);
    request.body(JSON.stringify(
        {
            context: "/",
            command: buildCommand(In, this.props["command"], this.props["parameters"])
        }
    ));
    this.getInputReference("Connection")().sendCommand(request);
    this.executeOutputLink("Out", In);

    function buildCommand(inMsg, cmd, parms) {
        var result = cmd;
        if (parms && parms.length > 0) {
            for (var i = 0; i < parms.length; i++) {
                result += " ";
                result += "\"" + replaceProps(inMsg, parms[i]) + "\"";
            }
        }
        return result;
    }

    function replaceProps(inMsg, value) {
        var result = value;
        inMsg.properties().forEach(function (p) {
            result = replaceAll(result, "\\{" + p.name() + "\\}", p.value().toString())
        });
        return replaceAll(result, '"', '""');
    }

    function replaceAll(str, find, replace) {
        return str.replace(new RegExp(find, 'g'), replace);
    }
}