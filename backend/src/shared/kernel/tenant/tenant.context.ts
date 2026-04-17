import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private _hotelId: string;
  private _userId: string;
  private _userRole: string;

  setTenant(hotelId: string, userId: string, userRole: string): void {
    this._hotelId = hotelId;
    this._userId = userId;
    this._userRole = userRole;
  }

  get hotelId(): string {
    return this._hotelId;
  }

  get userId(): string {
    return this._userId;
  }

  get userRole(): string {
    return this._userRole;
  }
}
