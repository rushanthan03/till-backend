import { Repository, FindOptionsWhere, DeepPartial, FindManyOptions, FindOneOptions } from 'typeorm';
import { Result } from '../../../domain/result/result';

export interface IGenericTypeOrmRepository<TDomain, TEntity> {
  findOne(options: FindOneOptions<TEntity>): Promise<Result<TDomain | null>>;
  findById(id: string): Promise<Result<TDomain | null>>;
  find(options?: FindManyOptions<TEntity>): Promise<Result<TDomain[]>>;
  create(document: DeepPartial<TEntity>): Promise<Result<TDomain>>;
  findOneAndUpdate(
    filterQuery: FindOptionsWhere<TEntity>,
    update: DeepPartial<TEntity>,
    options?: { session?: any },
  ): Promise<Result<TDomain | null>>;
  upsert(filterQuery: FindOptionsWhere<TEntity>, document: DeepPartial<TEntity>, options?: any): Promise<Result<TDomain | null>>;
  deleteMany(filterQuery: FindOptionsWhere<TEntity>): Promise<boolean>;
  startSession(): Promise<any>;
  insertMany(documents: DeepPartial<TEntity>[]): Promise<Result<TDomain[]>>;
  insertManyWithSession(docs: DeepPartial<TEntity>[], options?: any): Promise<Result<string[]>>;
  updateOne(filterQuery: FindOptionsWhere<TEntity>, update: DeepPartial<TEntity>): Promise<Result<TDomain>>;
  updateMany(query: FindOptionsWhere<TEntity>, updateBody: DeepPartial<TEntity>, options?: any): Promise<Result<TDomain[]>>;
  deleteOne(filterQuery: FindOptionsWhere<TEntity>): Promise<boolean>;
  objectIdToString(prop: string): string;
  stringToObjectId(prop: string): string;
}
