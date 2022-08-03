const defaultState = {
    user: {},
};

const user = (state = defaultState, action) => {
    switch (action.type) {
        case 'SET_USER': {
            return Object.assign({}, state, { user: action.state });
        }
        default:
            return state;
    }
};

export default user;
