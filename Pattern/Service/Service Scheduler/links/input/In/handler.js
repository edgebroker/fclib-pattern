function handler(In){

    this.assertProperty(In, "operation");
    this.assertProperty(In, "key");

    var op = In.property("operation").value().toString();
    switch (op) {
        case "attach":
            this.assertProperty(In, "forward");
            this.attachService(In.property("forward").value().toBoolean(), In.property("key").value().toString(), In);
            break;
        case "detach":
            this.assertProperty(In, "forward");
            this.detachService(In.property("forward").value().toBoolean(), In.property("key").value().toString(), In);
            break;
        case "send":
            this.sendService(In.property("key").value().toString(), In);
            break;
        default:
            throw "Invalid operation: "+op;
    }
}