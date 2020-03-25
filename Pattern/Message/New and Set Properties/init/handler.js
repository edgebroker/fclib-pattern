function handler() {
    this.properties = this.props["properties"];
    this.types = this.props["types"];
    this.values = this.props["values"];

    for (var i=0;i<this.properties.length;i++) {
        var type = this.properties[i]["type"];
        if (!(type === 'boolean' || type === 'string' || type === 'integer' || type === 'long' || type === 'double' || type === 'float'))
            throw "Invalid property type: " + type;
    }
}