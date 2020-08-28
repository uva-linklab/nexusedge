const url = require('url');

const mapping = {
    "ppts16": "https://www.dropbox.com/s/aucms2q4x9hgebi/anchor_configuration.json?dl=1",
    "ligeir": "https://rawgit.com/lab11/monjolo/master/summon/ligeiro/index.html",
    "edimax": "https://rawgit.com/lab11/edimax-lab11/master/summon/index.html",
    "hue": "https://rawgit.com/lab11/edimax-lab11/master/summon-hue/index.html",
    "Edukt0": "https://rawgit.com/lab11/polypoint/master/phone/tritag-summon/index.html",
    "bgauge": "https://rawgit.com/lab11/signpost/master/summon/bgauge/index.html",
    "6EKY8W": "https://cdn.rawgit.com/lab11/powerblade/030626a2aa748c0b0d7c3a69d9fd005d6d769667/software/summon/index.html",
    "WRzp2g": "https://cdn.rawgit.com/lab11/powerblade/030626a2aa748c0b0d7c3a69d9fd005d6d769667/software/summon/index.html",
    "qtn9V9": "https://cdn.rawgit.com/lab11/signpost/b0d85f00cf5dd5dbba3c834755a80388e116056d/solar_panel_test/summon/solar-test/index.html",
    "WRKqIy": "https://cdn.rawgit.com/lab11/signpost/b0d85f00cf5dd5dbba3c834755a80388e116056d/solar_panel_test/summon/solar-test/index.html",
    "2W2FTt": "https://cdn.rawgit.com/lab11/signpost/b0d85f00cf5dd5dbba3c834755a80388e116056d/solar_panel_test/summon/solar-test/index.html",
    "BA1zPM": "https://cdn.rawgit.com/lab11/signpost/b0d85f00cf5dd5dbba3c834755a80388e116056d/solar_panel_test/summon/solar-test/index.html",
    "8685Uw": "https://rawgit.com/helena-project/storm-ble/master/summon/firestorm-sensing/index.html",
    "hWTo8W": "https://rawgit.com/lab11/summon/master/examples/cordova-apps/os-agnostic/index.html",
    "nCQV8C": "https://rawgit.com/lab11/monoxalyze/master/software/summon/monoxalyze-collect/index.html",
    "sbMMHT": "https://cdn.rawgit.com/lab11/blees/1ba78e5c51afe7c10b885d2c5243229f6b4d093c/summon/squall-pir/index.html",
    "9aD6Wi": "https://cdn.rawgit.com/lab11/powerblade/030626a2aa748c0b0d7c3a69d9fd005d6d769667/software/summon/index.html",
    "2ImXWJ": "https://cdn.rawgit.com/lab11/blees/1ba78e5c51afe7c10b885d2c5243229f6b4d093c/summon/blees-demo/index.html",
    "dbhGnF": "https://cdn.rawgit.com/lab11/blees/1ba78e5c51afe7c10b885d2c5243229f6b4d093c/summon/blees-demo/index.html",
    "3YACnH": "https://raw.githubusercontent.com/lab11/gateway/master/devices/test/",
    "449K5X": "https://cdn.rawgit.com/lab11/torch/master/summon/torch/index.html",
    "jEKPu9": "https://cdn.rawgit.com/lab11/powerblade/030626a2aa748c0b0d7c3a69d9fd005d6d769667/software/summon/index.html",
    "xWppj1": "https://cdn.rawgit.com/lab11/blees/1ba78e5c51afe7c10b885d2c5243229f6b4d093c/summon/blees-demo/index.html",
    "signp": "http://rawgit.com/lab11/signpost/master/summon/demo/index.html",
    "signpost": "http://rawgit.com/lab11/signpost/master/summon/demo/index.html",
    "signpost_gateway": "141.212.11.245",
    "github": "https://github.com",
    "imix": "http://rawgit.com/helena-project/sensys16-demo/master/summon/demo/index.html",
    "herald": "http://rawgit.com/uva-linklab/herald/master/summon/herald/index.html",
    "LPCSB": "https://cdn.jsdelivr.net/gh/uva-linklab/LPCSB@master/summon/LPCSB/index.html",
    "lab11": "http://lab11.eecs.umich.edu",
    "tock": "https://github.com/tock/tock/blob/tutorial-sensys-2018/doc/courses/sensys/README.md",
    "tock1": "https://github.com/tock/tock/blob/tutorial-sensys-2018/doc/courses/sensys/environment.md",
    "tock2": "https://github.com/tock/tock/blob/tutorial-sensys-2018/doc/courses/sensys/application.md",
    "tock4": "https://github.com/tock/tock/blob/tutorial-sensys-2018/doc/courses/sensys/client.md",
    "tock5": "https://github.com/tock/tock/blob/tutorial-sensys-2018/doc/courses/sensys/freeform.md",
    "tock3": "https://github.com/helena-project/tock/blob/master/doc/courses/sensys/capsule.md",
    "perm": "https://lab11.github.io/permamote/gateway/",
    "golf": "https://www.youtube.com/watch?v=XSCavIY9KSI",
    "judo": "https://www.youtube.com/watch?v=DQKiy0FXQao",
    "data19": "https://docs.google.com/presentation/d/1PEXqc3ClfQABbHtcajOSzdmDjAC1p3RuNispjRmaVuY/edit",
    "heart": "https://nealsjackson.com/heartworm/summon/index.html"
};

/**
 * Converts a url like https://j2x.us/xxxx into its expanded form.
 * Temporary method until j2x.us has its https certificates restored.
 * @param shortUrl
 */
function getExpandedUrl(shortUrl) {
    const path = url.parse(shortUrl).pathname.slice(1); // slice to remove "/" from the beginning
    let expanded = undefined;
    if(mapping.hasOwnProperty(path)) {
        expanded = mapping[path];
    }
    return expanded;
}

module.exports.getExpandedUrl = getExpandedUrl;
