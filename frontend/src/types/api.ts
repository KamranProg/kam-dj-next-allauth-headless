export type ApiResponseStatus = {
  status: "success" | "error";
  message: string;
  /** Route to open next instead of the default destination. */
  next?: string;
  /** The email/password combination was rejected (not a server or network error). */
  wrongCredentials?: boolean;
};
