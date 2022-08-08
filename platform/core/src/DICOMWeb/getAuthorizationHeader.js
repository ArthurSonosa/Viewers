import user from '../user';

/**
 * Returns the Authorization header as part of an Object.
 *
 * @export
 * @param {Object} [server={}]
 * @param {Object} [server.requestOptions]
 * @param {string|function} [server.requestOptions.auth]
 * @returns {Object} { Authorization }
 */
export default function getAuthorizationHeader({ requestOptions } = {}) {
  const headers = {};

  // const store = window.store.getState();
  // const userStore = store.user;
  // console.log(store);

  // console.log(user)
  // console.log(user.getAccessToken);
  // console.log(user.getAccessToken());

  // Check for OHIF.user since this can also be run on the server
  const accessToken = user && user.getAccessToken && user.getAccessToken();
  // console.log(accessToken);

  headers.Authorization = `Bearer ${accessToken}`;

  // Auth for a specific server
  // if (requestOptions && requestOptions.auth) {
  //   if (typeof requestOptions.auth === 'function') {
  //     // Custom Auth Header
  //     headers.Authorization = requestOptions.auth(requestOptions);
  //   } else {
  //     // HTTP Basic Auth (user:password)
  //     headers.Authorization = `Basic ${btoa(requestOptions.auth)}`;
  //   }
  // }
  // // Auth for the user's default
  // else if (accessToken) {
  //   headers.Authorization = `Bearer ${accessToken}`;
  // }

  return headers;
}
