function handler(Registration) {

    this.assertProperty(Registration, "operation");
    this.assertProperty(Registration, "channelid");

    switch (Registration.property("operation").value().toString()) {
        case "attach":
            this.assertProperty(Registration, "context");
            this.addSubscription(Registration.property("context").value().toString(), Registration.property("channelid").value().toString());
            break;
        case "detach":
            this.assertProperty(Registration, "context");
            this.removeSubscription(Registration.property("context").value().toString(), Registration.property("channelid").value().toString());
            break;
    }
}