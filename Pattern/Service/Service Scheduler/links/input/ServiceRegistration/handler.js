function handler(ServiceRegistration){

    this.assertProperty(ServiceRegistration, "operation");
    this.assertProperty(ServiceRegistration, "queuename");

    var op = ServiceRegistration.property("operation").value().toString();
    switch (op) {
        case "add":
            this.addService(ServiceRegistration.property("queuename").value().toString());
            break;
        case "remove":
            this.removeService(ServiceRegistration.property("queuename").value().toString());
            break;
        default:
            throw "Invalid operation: "+op;
    }
}