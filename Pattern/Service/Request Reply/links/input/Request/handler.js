function handler(Request) {
    Request.replyTo(stream.tempQueue(this.compid + "_reply").destination());
    this.executeOutputLink("Out", Request);
}