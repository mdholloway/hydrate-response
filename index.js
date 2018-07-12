'use strict';

const P = require('bluebird');

/**
 * Traverses through a request body and replaces the given keys with
 * the content fetched using the 'fetch' callback
 * @param {Object} response the response object to hydrate
 * @param {Function} fetch the function used to fetch the content if it's not present
 */
module.exports = (response, fetch) => {
    const requests = {};
    const setters = [];

    function _traverse(node, removeFromParent) {
        function requestResource(resource) {
            requests[resource] = requests[resource] || fetch(resource);
            setters.push((content) => {
                if (content[resource]) {
                    Object.assign(node, content[resource]);
                } else if (removeFromParent) {
                    removeFromParent();
                }
                delete node.$merge;
            });
        }

        if (Array.isArray(node)) {
            // If the item is not available we need to delete it from the array
            // using the callback with splice. The callbacks are executed in the same
            // order as they're created here, so reverse the iteration order to
            // make removal of multiple elements work correctly.
            for (let i = node.length - 1; i >= 0; i--) {
                _traverse(node[i], () => node.splice(i, 1));
            }
        } else if (node && typeof node === 'object') {
            if (Array.isArray(node.$merge)) {
                node.$merge.forEach(requestResource);
            } else {
                Object.keys(node).forEach(key => _traverse(node[key], () => delete node[key]));
            }
        }
    }
    _traverse(response.body);

    return P.props(requests)
    .then(content => setters.forEach(setter => setter(content)))
    .thenReturn(response);
};
