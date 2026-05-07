import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const raw = localStorage.getItem('incident-platform-session');
  const token = raw ? JSON.parse(raw).token as string | undefined : undefined;
  if (!token) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

