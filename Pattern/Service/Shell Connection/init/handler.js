function handler() {
    var self = this;
    var routername = this.props["routername"] ? this.props["routername"] : stream.routerName();
    var appname = this.props["appname"] ? this.props["appname"] : stream.domainName();
    this.shellstream = "stream_" + routername + "_" + stream.domainName() + "_" + stream.packageName() + "_" + this.props["flowname"] + "_shell_" + this.props["shellname"];

    if (stream.output(this.shellstream) === null)
        stream.create().output(this.shellstream).topic();

    this.sendCommand = function (msg) {
        stream.output(self.shellstream).send(msg);
    };

    this.setOutputReference("Connection", execRef);

    function execRef() {
        return self;
    }
}