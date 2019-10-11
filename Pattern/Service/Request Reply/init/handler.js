function handler() {
    var self = this;
    stream.create().tempQueue(this.compid + "_reply");
    stream.create().input(stream.tempQueue(this.compid + "_reply")).queue().onInput(function (input) {
        self.executeOutputLink("Reply", input.current());
    });
}