function handler() {
    var self = this;

    this.services = [];
    this.nextService = 0;

    this.addService = function(name) {
        stream.log().info("addService: "+name);
        self.services.push({name: name, keys: []});
        if (self.props["lookupjndi"] === true)
            stream.create().output(name).forAddress(stream.lookupJNDI(name));
        else
            stream.create().output(name).queue();
    };

    this.removeService = function(name) {
        stream.log().info("removeService: "+name);
        for (var i=0; i<self.services.length; i++){
            if (self.services[i].name === name){
                self.services.splice(i, 1);
                break;
            }
        }
        stream.output(name).close();
    };

    this.attachService = function(forward, key, message){
        stream.log().info("attachService: key="+key+", forward="+forward);
        var service = findService(key);
        if (service === null)
            service = nextFreeService(key);
        var foundKey = findKey(service.keys, key);
        if (foundKey === null)
            throw "attachService: foundKey === null at service: "+JSON.stringify(service);
        foundKey.count++;
        stream.log().info("attachService: key="+key+", forward="+forward+", service="+JSON.stringify(service));
        if (forward === true)
            stream.output(service.name).send(message);
    };

    this.detachService = function(forward, key, message){
        stream.log().info("detachService: key="+key+", forward="+forward);
        var service = findService(key);
        if (service === null)
            throw "detachService: service not found!";
        var foundKey = findKey(service.keys, key);
        if (foundKey === null)
            throw "detachService: foundKey === null at service: "+JSON.stringify(service);
        foundKey.count--;
        if (foundKey.count === 0)
            removeKey(service.keys, key);
        stream.log().info("detachService: key="+key+", forward="+forward+", service="+JSON.stringify(service));
        if (forward === true)
            stream.output(service.name).send(message);
    };

    this.sendService = function(key, message){
        var service = findService(key);
        if (service === null) {
            if (self.props["autoattach"]) {
                stream.log().info("sendService: Service with key '" + key + "' not found, using auto attach");
                self.attachService(false, key, message);
                service = findService(key);
            } else
                throw "sendService: Service with key '" + key + "' not found!";
        }
        stream.output(service.name).send(message);
    };

    function findService(key) {
        for (var i=0; i<self.services.length; i++){
            for (var j=0;j<self.services[i].keys.length;j++){
                if (self.services[i].keys[j].name === key){
                    return self.services[i];
                }
            }
        }
        return null;
    }

    function findKey(keys, key) {
        for (var i=0;i<keys.length;i++){
            if (keys[i].name === key)
                return keys[i];
        }
        return null;
    }

    function removeKey(keys, key) {
        for (var i=0;i<keys.length;i++){
            if (keys[i].name === key){
                keys.splice(i, 1);
                break;
            }
        }
    }

    function nextFreeService(key){
        if (self.nextService === self.services.length-1)
            self.nextService = 0;
        else
            self.nextService++;
        var service = self.services[self.nextService];
        service.keys.push({name: key, count: 0});
        return service;
    }
}