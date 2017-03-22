function first(fullName) {
    if (fullName) {
        const separator = fullName.indexOf(' ');
        if (separator !== -1) {
            return fullName.substr(0, separator);
        }
        return fullName;
    }

    return '';
}

function last(fullName) {
    if (fullName) {
        const separator = fullName.indexOf(' ');
        if (separator !== -1) {
            return fullName.substr(separator + 1).trim();
        }
    }

    return '';
}

function full(firstName, lastName) {
    return (`${firstName || ''} ${lastName || ''}`).trim();
}

module.exports = {
    first,
    last,
    full,
};
