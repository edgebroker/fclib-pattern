function handler(In){
    if (In.type() !== "text")
        throw "Input message is not a text message!";
    this.assertProperty(In, "context");
    var json = stream.cli().contextJson(In.property("context").value().toString());
    if (json !== null) {
        In.body(json);
        this.executeOutputLink("Out", In);
    } else {
        In.body("Invalid context: "+In.property("context").value().toString());
        this.executeOutputLink("Error", In);
    }
}