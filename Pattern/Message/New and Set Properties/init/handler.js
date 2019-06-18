function handler() {
    this.properties = this.props["properties"];
    this.types = this.props["types"];
    this.values = this.props["values"];
    this.BOOLEAN = Java.type("java.lang.Boolean");
    this.INTEGER = Java.type("java.lang.Integer");
    this.LONG = Java.type("java.lang.Long");
    this.DOUBLE = Java.type("java.lang.Double");
    this.FLOAT = Java.type("java.lang.Float");



    for (var i=0;i<this.properties.length;i++) {
        var type = this.properties[i]["type"];
        if (!(type === 'boolean' || type === 'string' || type === 'integer' || type === 'long' || type === 'double' || type === 'float'))
            throw "Invalid property type: " + type;
    }
}