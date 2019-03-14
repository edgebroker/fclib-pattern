function handler(In) {
    var self = this;
    var outMsg = stream.create().message().message();

    for (var i=0;i<this.properties.length;i++){
        outMsg.property(this.properties[i]).set(convert(subSystemTags(subRefProps(In, this.flowcontext.substitute(this.values[i]))), this.types[i]));
    }

    this.executeOutputLink("Out", outMsg);

    function subSystemTags(value){
        var result = value;
        if (result.indexOf("[time]") !== -1)
            result = replaceAll(result, "\\[time\\]", time.currentTime()+"");
        return result;
    }

    function subRefProps(inMsg, value){
        var result = value;
        inMsg.properties().forEach(function(p){
            result = replaceAll(result, "\\{"+p.name()+"\\}", p.value().toString());
        });
        return result;
    }

    function replaceAll(str, find, replace) {
        return str.replace(new RegExp(find, 'g'), replace);
    }

    function convert(value, type){
        var result;
        switch (type){
            case 'boolean':
                result = new self.BOOLEAN(value);
                break;
            case 'string':
                result = value;
                break;
            case 'integer':
                result = new self.INTEGER(value);
                break;
            case 'long':
                result = new self.LONG(value);
                break;
            case 'double':
                result = new self.DOUBLE(value);
                break;
            case 'float':
                result = new self.FLOAT(value);
                break;
        }
        return result;
    }
}