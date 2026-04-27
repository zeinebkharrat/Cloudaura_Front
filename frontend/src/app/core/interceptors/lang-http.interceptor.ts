import { HttpInterceptorFn } from '@angular/common/http';

export const langHttpInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
