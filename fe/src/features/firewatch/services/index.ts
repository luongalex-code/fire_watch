import { IFireWatchService } from './contracts';
import { ApiFireWatchService } from './apiService';

export const fireWatchService: IFireWatchService = new ApiFireWatchService();

export * from './contracts';
export { ApiFireWatchService } from './apiService';
