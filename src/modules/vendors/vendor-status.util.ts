import { ForbiddenException } from '@nestjs/common';
import { Vendor } from './entities/vendor.entity';
import { VendorStatus } from './vendor.types';
import { ErrorMessages } from '../../common/swagger/error-messages';

/// A rejected or suspended vendor keeps their account (so they can still
/// see why and contact support) but must not be able to take any action —
/// unlike PENDING, which is still allowed to prep its menu/profile while
/// awaiting approval.
export function assertVendorNotBlocked(vendor: Vendor): void {
  if (
    vendor.status === VendorStatus.SUSPENDED ||
    vendor.status === VendorStatus.REJECTED
  ) {
    throw new ForbiddenException(ErrorMessages.VENDORS.BLOCKED);
  }
}
