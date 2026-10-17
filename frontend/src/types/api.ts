export type ApiResponseStatus = {
  status: "success" | "error";
  message: string;
  /** Route to open next instead of the default destination. */
  next?: string;
};
