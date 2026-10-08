import type { AuthService } from "./auth/authService";
import type { MailsService } from "./mails/mailsService";
import type { BatchesService } from "./batches/batchesService";
import type { RecipientsService } from "./recipients/recipientsService";
import type { SettingsService } from "./settings/settingsService";
import { MockAuthService } from "./auth/mockAuthService";
import { ApiAuthService } from "./auth/apiAuthService";
import { MockMailsService } from "./mails/mockMailsService";
import { ApiMailsService } from "./mails/apiMailsService";
import { MockBatchesService } from "./batches/mockBatchesService";
import { ApiBatchesService } from "./batches/apiBatchesService";
import { MockRecipientsService } from "./recipients/mockRecipientsService";
import { ApiRecipientsService } from "./recipients/apiRecipientsService";
import { MockSettingsService } from "./settings/mockSettingsService";
import { ApiSettingsService } from "./settings/apiSettingsService";

/**
 * Service registry.
 *
 * Phase 0 runs on isolated mock implementations (NEXT_PUBLIC_USE_MOCK_API != "false").
 * Once the backend endpoints exist, set NEXT_PUBLIC_USE_MOCK_API=false and every
 * screen switches to the real API with zero UI changes.
 */
const useMock = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";

export const authService: AuthService = useMock ? new MockAuthService() : new ApiAuthService();
export const mailsService: MailsService = useMock ? new MockMailsService() : new ApiMailsService();
export const batchesService: BatchesService = useMock
  ? new MockBatchesService()
  : new ApiBatchesService();
export const recipientsService: RecipientsService = useMock
  ? new MockRecipientsService()
  : new ApiRecipientsService();
export const settingsService: SettingsService = useMock
  ? new MockSettingsService()
  : new ApiSettingsService();
