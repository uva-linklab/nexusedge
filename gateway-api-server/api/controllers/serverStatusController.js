/**
 * This call gives the status of the server. It is primarily intended to be used as a means to check reachability.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getServerStatus = async function(req, res) {
    //for the time being use a simple json with a status=true key-value
    const status = {status: true};
    return res.json(status);
};