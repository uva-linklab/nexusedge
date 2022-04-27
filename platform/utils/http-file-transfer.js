const request = require('request-promise');
const fs = require('fs-extra');

/**
 * Post the files as multi-part form data to a specified uri.
 * @param uri
 * @param files fileName -> filePath mapping
 * @param textFields a js object containing any key-value pairs apart from files
 */
exports.transferFiles = function (uri, files, textFields) {
	const formData = {};

	// first copy all key-vals from textFields to formData
	Object.assign(formData, textFields);

	// add file streams to fields
	Object.keys(files).forEach(fileName => {
		const filePath = files[fileName];
		formData[fileName] = fs.createReadStream(filePath);
	});

	const options = {
	    method: 'POST',
	    uri: uri,
		formData: formData
	};

	return request(options);
};