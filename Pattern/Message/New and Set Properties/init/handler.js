function handler() {
    this.properties = this.props["properties"];
    this.types = this.props["types"];
    this.values = this.props["values"];
    this.BOOLEAN = Java.type("java.lang.Boolean");
    this.INTEGER = Java.type("java.lang.Integer");
    this.LONG = Java.type("java.lang.Long");
    this.DOUBLE = Java.type("java.lang.Double");
    this.FLOAT = Java.type("java.lang.Float");

    if (this.properties.length !== this.types.length || this.properties.length !== this.values.length)
        throw "Invalid number of entries for types or values";

    for (var i=0;i<this.types.length;i++) {
        var t = this.types[i];
        if (!(t === 'boolean' || t === 'string' || t === 'integer' || t === 'long' || t === 'double' || t === 'float'))
            throw "Invalid property type: " + t;
    }
}