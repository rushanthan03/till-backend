

export interface IAuthStrategy {
  validate(request: Request, payload: any): unknown;
}

interface IPayload {
  email: string;
  role: string;
}

export interface IUserPayload extends IPayload {
  userId: string;
}

export interface IJwtPayload extends IPayload {
  sub: string;
}
export interface ISignUpTokens {
  refreshToken: string;
  accessToken: string;
}

export interface ILogin {
  email: string;
  password: string;
}
