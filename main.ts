//% weight=6 color=#2699BF icon="\uf1eb" block="CW01_ATT"
namespace cw01_att
{

    class cw01_int_var123 {
        res: string
        NEWLINE: string
        DEVICE_ID: string
        TOKEN: string
        start: boolean
        asset_name: string
        timer: number
        mqtt_message: string
        constructor() {
            this.res = ""
            this.NEWLINE = "\u000D\u000A"
            this.DEVICE_ID = ""
            this.TOKEN = ""
            this.asset_name = ""
            this.timer = 0
            this.mqtt_message = ""
        }
    }

    class cw01_mqtt {
        new_payload: string
        prev_payload: string
        new_topic: string
        prev_topic: string
        enable_event_1: boolean
        enable_event_2: boolean
        id: string
        id_enable: boolean
        timer_enable: boolean
        sending_payload: boolean
        sending_pingreq: boolean
        receiving_msg: boolean
        mqtt_busy: boolean
        mac_addr: string

        constructor() {
            this.new_payload = ""
            this.prev_payload = ""
            this.new_topic = ""
            this.prev_topic = ""
            this.enable_event_1 = false
            this.enable_event_2 = false
            this.id = ""
            this.id_enable = false
            this.timer_enable = true
            this.sending_payload = false
            this.sending_pingreq = false
            this.receiving_msg = false
            this.mac_addr = ""
            this.mqtt_busy = false
        }
    }

    class button_class {
        sending_data: boolean

        constructor() {
            this.sending_data = false
        }
    }

    let cw01_button_object = new button_class()
    let cw01_vars = new cw01_int_var123()
    let cw01_mqtt_vars = new cw01_mqtt()
    let en_Feedback: boolean = false
    let en_doubleLink: boolean = false
        let cmd_rcvd_count: number = 0

    cw01_vars.start = true
    serial.redirect(SerialPin.P1, SerialPin.P0, 115200)
    serial.setRxBufferSize(200)

    basic.showIcon(IconNames.Chessboard)
    basic.pause(2000)
    serial.writeString("ATE0" + cw01_vars.NEWLINE)
    basic.pause(300)
    serial.readString()
    serial.writeString("AT+CWMODE_DEF=3" + cw01_vars.NEWLINE)
    basic.pause(300)
    serial.writeString("AT+CIPRECVMODE=1" + cw01_vars.NEWLINE)
    basic.pause(300)
    serial.writeString("AT+TEST" + cw01_vars.NEWLINE)
    basic.pause(300)
    serial.readString();
    serial.writeString("AT+CWHOSTNAME?" + cw01_vars.NEWLINE);
    basic.pause(1000)

    read_and_set_name();

    function read_and_set_name(): void {
        let name: string = "";
        name = serial.readString()

        if (!(name.includes("CW01"))) {
            serial.writeString("AT+CWHOSTNAME=\"CW01\"" + cw01_vars.NEWLINE)
            basic.pause(1000)
            control.reset()
        }
    }

    function extract_mac(): string {
        let raw_str: string = ""
        let mac_addr: string = ""
        let index: number = 0
        serial.writeString("AT+CIPSTAMAC_CUR?" + cw01_vars.NEWLINE)
        basic.pause(500)
        raw_str = serial.readString()
        index = raw_str.indexOf("\"") + 1

        mac_addr = raw_str.substr(index, 17)

        return mac_addr
    }

    /**
    * Connect to W-Fi 
    */
    //% weight=91 color=#ad0303
    //% group="WiFi"
    //% blockId="connectToWifi" block="CW01 connect to WiFi SSID %SSID password %PSK"
    export function connectToWifi(SSID: string, PSK: string): void {
        serial.writeString("AT+CWMODE=1" + cw01_vars.NEWLINE)
        basic.pause(100)
        serial.readString()
        serial.writeString("AT+CWJAP=\"" + SSID + "\",\"" + PSK + "\"" + cw01_vars.NEWLINE)
        basic.pause(200)
        serial.readString()

        let loop_count = 0

        do {
            cw01_vars.res = serial.readString()
            basic.pause(1000)
            loop_count++

            if(loop_count == 20)
                break
        } while (!cw01_vars.res.includes("WIFI CONNECTED"));

        if (cw01_vars.res.includes("WIFI CONNECTED")) {
            basic.showString("C")
            basic.pause(5000)
            basic.showString("")
            cw01_vars.res = ""
        }

        if(loop_count == 20)
        {
            basic.showString("D")
            basic.pause(5000)
            basic.showString("")
        }
    }

    /**
    * Enable feedback through microbit Matrix LEDs
    */
    //% weight=91 color=#ad0303
    //% group="WiFi"
    //% blockId="enableFeedback" block="CW01 enable feedback LEDs %u"
    export function enableFeedback(u: boolean): void
    {
        en_Feedback = u
    }

    /**
    * Connect to AllThingsTalk IoT platform
    */
    //% weight=91
    //% group="ATT"
    //% blockId="connectToATT" block="CW01 connect to ATT with token %TKN and device-id %ID"
    export function connectToATT(TKN: string, ID: string): void {
        cw01_vars.DEVICE_ID = ID
        cw01_vars.TOKEN = TKN
        en_doubleLink =  true
        serial.writeString("AT+CIPMUX=1" + cw01_vars.NEWLINE)
        basic.pause(100)
        serial.writeString("AT+CIPSTART=0,\"TCP\",\"api.allthingstalk.io\",80" + cw01_vars.NEWLINE)
        basic.pause(1000)
        IoTMQTTConnect("api.allthingstalk.io", cw01_vars.TOKEN, "xinabox")
        basic.showLeds(`
        . . . . .
        . . . . .
        # . # . #
        . . . . .
        . . . . .
        `)
    }


    /**
    * Send string data to AllThingsTalk IoT platform
    */
    //% weight=91
    //% group="ATT"
    //% blockId="IoTSendStringToATT" block="CW01 send string %value to ATT asset %asset"
    export function IoTSendStringToATT(value: string, asset: string): void {

        let att_connected: string = ""

        while (cw01_button_object.sending_data) {
            basic.pause(100)
        }

        cw01_button_object.sending_data = true

        do {

            cw01_vars.asset_name = asset
            serial.writeString("AT+CIPMODE=0" + cw01_vars.NEWLINE)
            basic.pause(100)
            let payload: string = "{\"value\": " + value + "}"
            let request: string = "PUT /device/" + cw01_vars.DEVICE_ID + "/asset/" + cw01_vars.asset_name + "/state" + " HTTP/1.1" + cw01_vars.NEWLINE +
                "Host: api.allthingstalk.io" + cw01_vars.NEWLINE +
                "User-Agent: CW01/1.0" + cw01_vars.NEWLINE +
                "Accept: */*" + cw01_vars.NEWLINE +
                "Authorization: Bearer " + cw01_vars.TOKEN + cw01_vars.NEWLINE +
                "Content-Type:application/json" + cw01_vars.NEWLINE +
                "Content-Length: " + (payload.length).toString() + cw01_vars.NEWLINE + cw01_vars.NEWLINE + payload + cw01_vars.NEWLINE


            serial.writeString("AT+CIPSEND=0," + (request.length + 2).toString() + cw01_vars.NEWLINE)
            basic.pause(50)
            serial.writeString(request + cw01_vars.NEWLINE)
            basic.pause(1000)

            att_connected = serial.readString()

            if (att_connected.includes("link is not valid")) {
                connectToATT(cw01_vars.TOKEN, cw01_vars.DEVICE_ID)
            } else {
                att_connected = ""
            }

            get_status()

        } while (att_connected.includes("link is not valid"))

        cw01_button_object.sending_data = false

    }

    /**
    * Send numerical data to AllThingsTalk IoT platform
    */
    //% weight=91
    //% group="ATT"
    //% blockId="IoTSendValueToATT" block="CW01 send value %value to ATT asset %asset"
    export function IoTSendValueToATT(value: number, asset: string): void {

        let att_connected: string = ""

        while (cw01_button_object.sending_data) {
            basic.pause(100)
        }

        cw01_button_object.sending_data = true

        do {

            cw01_vars.asset_name = asset
            serial.writeString("AT+CIPMODE=0" + cw01_vars.NEWLINE)
            basic.pause(100)
            let payload: string = "{\"value\": " + value.toString() + "}"
            let request: string = "PUT /device/" + cw01_vars.DEVICE_ID + "/asset/" + cw01_vars.asset_name + "/state" + " HTTP/1.1" + cw01_vars.NEWLINE +
                "Host: api.allthingstalk.io" + cw01_vars.NEWLINE +
                "User-Agent: CW01/1.0" + cw01_vars.NEWLINE +
                "Accept: */*" + cw01_vars.NEWLINE +
                "Authorization: Bearer " + cw01_vars.TOKEN + cw01_vars.NEWLINE +
                "Content-Type:application/json" + cw01_vars.NEWLINE +
                "Content-Length: " + (payload.length).toString() + cw01_vars.NEWLINE + cw01_vars.NEWLINE + payload + cw01_vars.NEWLINE


            serial.writeString("AT+CIPSEND=0," + (request.length + 2).toString() + cw01_vars.NEWLINE)
            basic.pause(50)
            serial.writeString(request + cw01_vars.NEWLINE)
            basic.pause(1000)

            att_connected = serial.readString()

            if (att_connected.includes("link is not valid")) {
                connectToATT(cw01_vars.TOKEN, cw01_vars.DEVICE_ID)
            } else {
                att_connected = ""
            }

            get_status()

        } while (att_connected.includes("link is not valid"))

        cw01_button_object.sending_data = false
    }

    /**
    * Send boolean data to AllThingsTalk IoT platform
    */
    //% weight=91
    //% group="ATT"
    //% blockId="IoTSendStateToATT" block="CW01 send state %state to ATT asset %asset_name"
    export function IoTSendStateToATT(state: boolean, asset: string): void {

        let att_connected: string = ""

        while (cw01_button_object.sending_data) {
            basic.pause(100)
        }


        cw01_button_object.sending_data = true

        do {

            let stateStr: string

            if (state == true) {
                stateStr = "true"
            } else {
                stateStr = "false"
            }

            cw01_vars.asset_name = asset
            serial.writeString("AT+CIPMODE=0" + cw01_vars.NEWLINE)
            basic.pause(100)
            let payload: string = "{\"value\": " + stateStr + "}"
            let request: string = "PUT /device/" + cw01_vars.DEVICE_ID + "/asset/" + cw01_vars.asset_name + "/state" + " HTTP/1.1" + cw01_vars.NEWLINE +
                "Host: api.allthingstalk.io" + cw01_vars.NEWLINE +
                "User-Agent: CW01/1.0" + cw01_vars.NEWLINE +
                "Accept: */*" + cw01_vars.NEWLINE +
                "Authorization: Bearer " + cw01_vars.TOKEN + cw01_vars.NEWLINE +
                "Content-Type:application/json" + cw01_vars.NEWLINE +
                "Content-Length: " + (payload.length).toString() + cw01_vars.NEWLINE + cw01_vars.NEWLINE + payload + cw01_vars.NEWLINE


            serial.writeString("AT+CIPSEND=0," + (request.length + 2).toString() + cw01_vars.NEWLINE)
            basic.pause(50)
            serial.writeString(request + cw01_vars.NEWLINE)
            basic.pause(1000)

            att_connected = serial.readString()

            if (att_connected.includes("link is not valid")) {
                connectToATT(cw01_vars.TOKEN, cw01_vars.DEVICE_ID)
            } else {
                att_connected = ""
            }

            get_status()

        } while (att_connected.includes("link is not valid"))

        cw01_button_object.sending_data = false


    }

    /**
    * Send boolean data to AllThingsTalk IoT platform
    */
    //% weight=91
    //% group="ATT"
    //% blockId="IoTSendGPSToATT" block="CW01 send GPS latitude %lat and lonitude %lon to ATT asset %asset_name"
    export function IoTSendGPSToATT(lat: string, lon: string, asset_name: string): void {

        let att_connected: string = ""

        while (cw01_button_object.sending_data) {
            basic.pause(100)
        }


        cw01_button_object.sending_data = true

        do {

            cw01_vars.asset_name = asset_name
            serial.writeString("AT+CIPMODE=0" + cw01_vars.NEWLINE)
            basic.pause(100)
            let payload: string = "{\"value\": {\"latitude\":" + lat +", \"longitude\":" + lon + "} }"
            let request: string = "PUT /device/" + cw01_vars.DEVICE_ID + "/asset/" + cw01_vars.asset_name + "/state" + " HTTP/1.1" + cw01_vars.NEWLINE +
                "Host: api.allthingstalk.io" + cw01_vars.NEWLINE +
                "User-Agent: CW01/1.0" + cw01_vars.NEWLINE +
                "Accept: */*" + cw01_vars.NEWLINE +
                "Authorization: Bearer " + cw01_vars.TOKEN + cw01_vars.NEWLINE +
                "Content-Type:application/json" + cw01_vars.NEWLINE +
                "Content-Length: " + (payload.length).toString() + cw01_vars.NEWLINE + cw01_vars.NEWLINE + payload + cw01_vars.NEWLINE


            serial.writeString("AT+CIPSEND=0," + (request.length + 2).toString() + cw01_vars.NEWLINE)
            basic.pause(50)
            serial.writeString(request + cw01_vars.NEWLINE)
            basic.pause(1000)

            att_connected = serial.readString()

            if (att_connected.includes("link is not valid")) {
                connectToATT(cw01_vars.TOKEN, cw01_vars.DEVICE_ID)
            } else {
                att_connected = ""
            }

            get_status()

        } while (att_connected.includes("link is not valid"))

        cw01_button_object.sending_data = false


    }

    /**
    * Get latest value of asset from AllThingsTalk IoT platform. Asset can be string, numerical and boolean
    */
    //% weight=91
    //% group="ATT"
    //% blockId="IoTgetATTAssetValue" block="CW01 get ATT asset %asset state"
    export function IoTgetATTAssetValue(asset: string): string {
        let att_connected: string = ""

        while (cw01_button_object.sending_data) {
            basic.pause(100)
        }

        cw01_button_object.sending_data = true


        cw01_vars.res = ""
        let index1: number
        let index2: number
        let value: string

        do {

            cw01_vars.asset_name = asset
            basic.pause(100)
            let request: string = "GET /device/" + cw01_vars.DEVICE_ID + "/asset/" + cw01_vars.asset_name + "/state" + " HTTP/1.1" + cw01_vars.NEWLINE +
                "Host: api.allthingstalk.io" + cw01_vars.NEWLINE +
                "User-Agent: CW01/1.0" + cw01_vars.NEWLINE +
                "Accept: */*" + cw01_vars.NEWLINE +
                "Authorization: Bearer " + cw01_vars.TOKEN + cw01_vars.NEWLINE + cw01_vars.NEWLINE


            serial.writeString("AT+CIPSEND=0," + (request.length + 2).toString() + cw01_vars.NEWLINE)
            basic.pause(50)
            serial.writeString(request + cw01_vars.NEWLINE)
            basic.pause(1200)

            att_connected = serial.readString()

            if (att_connected.includes("link is not valid")) {
                connectToATT(cw01_vars.TOKEN, cw01_vars.DEVICE_ID)
            } else {
                att_connected = ""
            }

            if (!att_connected.includes("link is not valid")) {
                serial.writeString("AT+CIPRECVDATA=200" + cw01_vars.NEWLINE)
                basic.pause(100)
                serial.readString()
                basic.pause(400)
                serial.writeString("AT+CIPRECVDATA=200" + cw01_vars.NEWLINE)
                basic.pause(400)
                cw01_vars.res += serial.readString()
                index1 = cw01_vars.res.indexOf("\"value\":") + "\"value\":".length
                index2 = cw01_vars.res.indexOf("}", index1)
                value = cw01_vars.res.substr(index1, index2 - index1)
            }

        } while (att_connected.includes("link is not valid"))

        cw01_button_object.sending_data = false

        return value

    }

    function get_status(): boolean {

        basic.pause(400)
        serial.writeString("AT+CIPRECVDATA=0,200" + cw01_vars.NEWLINE)
        basic.pause(300)
        cw01_vars.res = serial.readString()

        if(en_Feedback)
        {
            if (cw01_vars.res.includes("HTTP/1.1 200") || cw01_vars.res.includes("HTTP/1.0 200") || cw01_vars.res.includes("HTTP/1.1 201") || cw01_vars.res.includes("HTTP/1.0 202")) {
                basic.showIcon(IconNames.Yes, 50)
                basic.showString("", 50)
                return true
            } else {
                basic.showIcon(IconNames.No, 50)
                basic.showString("", 50)
                return false
            }
        }else {
            if (cw01_vars.res.includes("HTTP/1.1 200") || cw01_vars.res.includes("HTTP/1.0 200") || cw01_vars.res.includes("HTTP/1.1 201") || cw01_vars.res.includes("HTTP/1.0 202"))
            {
                basic.pause(200)
                return true
            }else{
                basic.pause(200)
                return false
            }
        }
    }

        /**
    * The function is a callback function. It executes block inside the function whenever commands from subscribed topic is received
    */
    //% weight=91
    //% group="ATT"
    //% block="CW01 on command received"
    //% blockId =onCommandReceived
    //% draggableParameters=reporter
    export function onCommandReceived(handler: (value: string, asset_name: string) => void) {

        control.onEvent(EventBusSource.MICROBIT_ID_BUTTON_AB, EventBusValue.MICROBIT_BUTTON_EVT_CLICK, function () {

            basic.pause(20000)

            basic.showString("#")

            if(cmd_rcvd_count == 0)
            {
                cmd_rcvd_count = 1

                serial.writeString("AT+CIPRECVDATA=1,2000" + cw01_vars.NEWLINE)
                basic.pause(100)
                serial.readString()

            }

            serial.onDataReceived("\n", function () {

                while (cw01_mqtt_vars.sending_payload || cw01_mqtt_vars.sending_pingreq) {
                    basic.pause(100)
                }

                cw01_mqtt_vars.mqtt_busy = true

                let serial_res: string = serial.readString()
                let ctrl_pkt: number
                ctrl_pkt = 0

                if (serial_res.includes("IPD")) {
                    serial.readString()

                    let byte: number = 0

                    serial.writeString("AT+CIPRECVDATA=1,1" + cw01_vars.NEWLINE)
                    basic.pause(100)

                    let count = 0
                    let buf = pins.createBuffer(1)

                    while(byte != 58)
                    {
                        buf.setNumber(NumberFormat.UInt8LE, 0, serial.readBuffer(1)[0])
                        if(buf)
                        {
                            byte = buf.getNumber(NumberFormat.Int8LE, 0)
                        }else{
                            break
                        }
                    }

                    ctrl_pkt = (pins.unpackBuffer("!B", serial.readBuffer(1)))[0]

                    if (ctrl_pkt == 48) {
                        IoTMQTTGetData()
                        handler(IoTATTGetValue(), IoTATTGetAssetName())
                    } else if (ctrl_pkt == 208) {
                        ctrl_pkt = 0
                        serial.writeString("AT+CIPRECVDATA=1,200" + cw01_vars.NEWLINE)
                        basic.pause(100)
                    }
                }

                cw01_mqtt_vars.mqtt_busy = false

            })
        })
    }

    
    /**
    * Connect to MQTT broker through port number 1883
    */
    //% weight=91
    function IoTMQTTConnect(broker: string, Username: string, Password: string): void {

        if(en_doubleLink)
        {
            serial.writeString("AT+CIPSTART=1,\"TCP\",\"" + broker + "\",1883" + cw01_vars.NEWLINE)
        }else{
            serial.writeString("AT+CIPSTART=\"TCP\",\"" + broker + "\",1883" + cw01_vars.NEWLINE)
        }
        basic.pause(7000)

        let protocol_name_prior: Buffer = pins.packBuffer("!H", [4])
        let protocol_name: string = "MQTT"
        let protocol_lvl: Buffer = pins.packBuffer("!B", [4])
        //let msg_part_one: string = protocol_name + protocol_lvl
        let connect_flags: Buffer = (pins.packBuffer("!B", [(1 << 7) | (1 << 6) | (1 << 1)]))
        let keep_alive: Buffer = pins.packBuffer("!H", [3600])
        let client_id: string

        if (cw01_mqtt_vars.id_enable) {
            client_id = cw01_mqtt_vars.id
        } else {
            client_id = cw01_mqtt_vars.mac_addr
        }

        let client_id_len: Buffer = pins.packBuffer("!H", [client_id.length])
        let username: string = Username
        let username_len: Buffer = pins.packBuffer("!H", [username.length])
        let password: string = Password
        let password_len: Buffer = pins.packBuffer("!H", [password.length])
        //let msg_part_two = client_id_len + client_id + username_len + username + password_len + password

        if(en_doubleLink)
        {
            serial.writeString("AT+CIPSEND=1," + (1 + 1 + protocol_name_prior.length + protocol_name.length + protocol_lvl.length + connect_flags.length + keep_alive.length + client_id_len.length + client_id.length + username_len.length + username.length + password_len.length + password.length) + cw01_vars.NEWLINE)
        }else{
            serial.writeString("AT+CIPSEND=" + (1 + 1 + protocol_name_prior.length + protocol_name.length + protocol_lvl.length + connect_flags.length + keep_alive.length + client_id_len.length + client_id.length + username_len.length + username.length + password_len.length + password.length) + cw01_vars.NEWLINE)
        }
        basic.pause(1000)

        //Msg part one
        serial.writeBuffer(pins.packBuffer("!B", [1 << 4]))
        serial.writeBuffer(pins.packBuffer("!B", [protocol_name_prior.length + protocol_name.length + protocol_lvl.length + connect_flags.length + keep_alive.length + client_id_len.length + client_id.length + username_len.length + username.length + password_len.length + password.length]))

        //Msg part two
        serial.writeBuffer(protocol_name_prior)
        serial.writeString(protocol_name)
        serial.writeBuffer(protocol_lvl)
        serial.writeBuffer(connect_flags)
        serial.writeBuffer(keep_alive)
        serial.writeBuffer(client_id_len)
        serial.writeString(client_id)
        serial.writeBuffer(username_len)
        serial.writeString(username)
        serial.writeBuffer(password_len)
        serial.writeString(password)

        basic.pause(3000)

        cw01_vars.timer = input.runningTime()

        if(en_doubleLink)
        {
            serial.writeString("AT+CIPRECVDATA=1,200" + cw01_vars.NEWLINE)
        }else{
            serial.writeString("AT+CIPRECVDATA=200" + cw01_vars.NEWLINE)
        }
        basic.pause(100)
        serial.readString()

        control.inBackground(function () {
            while (true) {
                basic.pause(30000)
                if (((input.runningTime() - cw01_vars.timer) > 180000) && !cw01_mqtt_vars.sending_payload && !cw01_mqtt_vars.receiving_msg) {
                    cw01_mqtt_vars.sending_pingreq = true
                    cw01_vars.timer = input.runningTime()
                    let header_one: Buffer = pins.packBuffer("!B", [0xC0])
                    let header_two: Buffer = pins.packBuffer("!B", [0x00])

                    if(en_doubleLink)
                    {
                        serial.writeString("AT+CIPSEND=1," + (header_one.length + header_two.length) + cw01_vars.NEWLINE)
                    }else{
                        serial.writeString("AT+CIPSEND=" + (header_one.length + header_two.length) + cw01_vars.NEWLINE)
                    }
                    basic.pause(100)

                    serial.writeBuffer(header_one)
                    serial.writeBuffer(header_two)

                    cw01_mqtt_vars.sending_pingreq = false
                }


            }
        })

        control.raiseEvent(EventBusSource.MICROBIT_ID_BUTTON_AB, EventBusValue.MICROBIT_BUTTON_EVT_CLICK)


    }

        /**
    * Subscribe to ATT asset
    */
    //% weight=91
    //% group="ATT"
    //% blockId="IoTATTSubscribe" block="CW01 subscribe to ATT asset command %asset"
    export function IoTATTSubscribe(asset: string): void {

        while (cw01_mqtt_vars.sending_pingreq || cw01_mqtt_vars.receiving_msg || cw01_mqtt_vars.mqtt_busy) {
            basic.pause(100)
        }

        //Msg part two
        let pid: Buffer = pins.packBuffer("!H", [0xDEAD])
        let qos: Buffer = pins.packBuffer("!B", [0x00])
        let topic: string = "device/" + cw01_vars.DEVICE_ID + "/asset/" + asset + "/command"
        let topic_len: Buffer = pins.packBuffer("!H", [topic.length])

        //Msg part one
        let ctrl_pkt: Buffer = pins.packBuffer("!B", [0x82])
        let remain_len: Buffer = pins.packBuffer("!B", [pid.length + topic_len.length + topic.length + qos.length])

        serial.writeString("AT+CIPSEND=1," + (ctrl_pkt.length + remain_len.length + pid.length + topic_len.length + topic.length + qos.length) + cw01_vars.NEWLINE)

        basic.pause(1000)

        serial.writeBuffer(ctrl_pkt)
        serial.writeBuffer(remain_len)
        serial.writeBuffer(pid)
        serial.writeBuffer(topic_len)
        serial.writeString(topic)
        serial.writeBuffer(qos)

        basic.pause(2000)

        serial.readString()

        /*serial.writeString("AT+CIPRECVDATA=1" + cw01_vars.NEWLINE)
        basic.pause(100)
        serial.readBuffer(17)
        basic.showNumber((pins.unpackBuffer("!B", serial.readBuffer(1)))[0])*/

        serial.writeString("AT+CIPRECVDATA=1,200" + cw01_vars.NEWLINE)
        basic.pause(100)
        serial.readString()

        basic.pause(100)

    }
    

    

    function IoTMQTTGetData(): void {
        let topic_len_MSB: number[]
        let topic_len_LSB: number[]
        let topic_len: number = 0

        let payload: string

        cw01_mqtt_vars.sending_payload.toString()
        while (cw01_mqtt_vars.sending_payload || cw01_mqtt_vars.sending_pingreq) {
            basic.pause(100)
        }

        cw01_mqtt_vars.receiving_msg = true

        serial.writeString("AT+CIPRECVDATA=1,1" + cw01_vars.NEWLINE)
        basic.pause(200)
        serial.readString()
        serial.writeString("AT+CIPRECVDATA=1,1" + cw01_vars.NEWLINE)
        basic.pause(200)
        serial.readBuffer(17)
        topic_len_MSB = pins.unpackBuffer("!B", serial.readBuffer(1))
        serial.readString()
        serial.writeString("AT+CIPRECVDATA=1,1" + cw01_vars.NEWLINE)
        basic.pause(200)
        serial.readBuffer(17)
        topic_len_LSB = pins.unpackBuffer("!B", serial.readBuffer(1))
        serial.readString()

        topic_len = (topic_len_MSB[0] << 8) + topic_len_LSB[0]

        serial.writeString("AT+CIPRECVDATA=1,200" + cw01_vars.NEWLINE)
        basic.pause(200)

        cw01_vars.mqtt_message = serial.readString()

        cw01_mqtt_vars.new_topic = cw01_vars.mqtt_message.substr(cw01_vars.mqtt_message.indexOf(":") + 1, topic_len)
        cw01_mqtt_vars.new_payload = cw01_vars.mqtt_message.substr(cw01_vars.mqtt_message.indexOf(":") + 1 + cw01_mqtt_vars.new_topic.length, cw01_vars.mqtt_message.length - (cw01_vars.mqtt_message.indexOf(":") + cw01_mqtt_vars.new_topic.length + 7))

        cw01_mqtt_vars.receiving_msg = false
    }

    function IoTATTGetValue(): string {

        let index1 = cw01_mqtt_vars.new_payload.indexOf("\"value\":") + "\"value\":".length
        let index2 = cw01_mqtt_vars.new_payload.indexOf(",", index1)
        let value = cw01_mqtt_vars.new_payload.substr(index1, index2 - index1)
        return value
    }

    function IoTATTGetAssetName(): string {

        let index1 = cw01_mqtt_vars.new_topic.indexOf("/asset/") + "/asset/".length
        let index2 = cw01_mqtt_vars.new_topic.indexOf("/", index1)
        let asset = cw01_mqtt_vars.new_topic.substr(index1, index2 - index1)

        return asset

    }
}