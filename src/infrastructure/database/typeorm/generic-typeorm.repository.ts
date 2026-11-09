import { HttpStatus } from '@nestjs/common';
import { Repository, FindOptionsWhere, FindManyOptions, FindOneOptions, UpdateResult, DeleteResult, DeepPartial } from 'typeorm';
import { Result } from '../../../domain/result/result';
import { throwApplicationError } from '../../utilities/exception-instance';
import { IGenericTypeOrmRepository } from './generic-typeorm.interface';

export abstract class GenericTypeOrmRepository<TEntity, TModel> implements IGenericTypeOrmRepository<TEntity, TModel> {
  constructor(
    protected readonly repository: Repository<TModel>,
    private readonly mapper: any,
  ) { }

  public objectIdToString(objectId: string): string {
    return objectId;
  }

  public stringToObjectId(prop: string): string {
    return prop;
  }

  async count(query: FindOptionsWhere<TModel>): Promise<number> {
    return this.repository.count({ where: query });
  }

  async aggregate(query: any[]): Promise<any> {
    // TypeORM doesn't have direct aggregation support like MongoDB
    // This would need to be implemented using QueryBuilder
    throw new Error('Aggregation not implemented for TypeORM');
  }

  async findOne(filterQuery: FindOneOptions<TModel>): Promise<Result<TEntity | null>> {
    try {
      const document = await this.repository.findOne(filterQuery);
      if (!document) {
        return Result.fail('Error getting document from database', HttpStatus.NOT_FOUND);
      }
      const entity = this.mapper.toDomain(document);
      return Result.ok(entity);
    } catch (error) {
      console.error(error);
      return Result.fail('Error getting document from database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findById(id: string): Promise<Result<TEntity | null>> {
    try {
      const document = await this.repository.findOne({ where: { id } as any });
      if (!document) {
        return Result.fail('Error getting document from database', HttpStatus.NOT_FOUND);
      }
      const entity = this.mapper.toDomain(document);
      return Result.ok(entity);
    } catch (error) {
      console.error(error);
      return Result.fail('Error getting document from database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async find(
    query: FindManyOptions<TModel>,
  ): Promise<Result<TEntity[] | []>> {
    try {
      const documents = await this.repository.find(query);
      const entities = documents?.length ? documents.map((document) => this.mapper.toDomain(document)) : [];
      return Result.ok(entities);
    } catch (error) {
      console.error(error);
      return Result.fail('Error getting documents from database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async pagination(query: FindManyOptions<TModel>) {
    const pageSize = 500;
    const page = (query.skip || 0) / pageSize + 1;
    const skip = (page - 1) * pageSize;
    const limit = query.take || pageSize;

    const documents = await this.repository.find({
      ...query,
      skip,
      take: limit,
    });

    return documents.map((doc) => this.mapper.toDomain(doc));
  }

  async create(document: DeepPartial<TModel>): Promise<Result<TEntity>> {
    try {
      const doc = this.repository.create(document as any);
      const result = await this.repository.save(doc);
      if (!result) {
        return Result.fail('An Error occurred, unable to save document in the db', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const entity = this.mapper.toDomain(result);
      return Result.ok(entity);
    } catch (error) {
      console.error(error);
      return Result.fail('An Error occurred, unable to save document in the db', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneAndUpdate(
    filterQuery: FindOptionsWhere<TModel>,
    update: DeepPartial<TModel>,
  ): Promise<Result<TEntity | null>> {
    try {
      const result = await this.repository.update(filterQuery, update as any);
      if (result.affected === 0) {
        return Result.fail('An Error occurred, unable to update the database', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const updatedany = await this.repository.findOne({ where: filterQuery });
      if (!updatedany) {
        return Result.fail('An Error occurred, unable to find updated document', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const entity = this.mapper.toDomain(updatedany);
      return Result.ok(entity);
    } catch (error) {
      console.error(error);
      return Result.fail('An Error occurred, unable to update the database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async upsert(
    filterQuery: FindOptionsWhere<TModel>,
    document: DeepPartial<TModel>,
    options?: any,
  ): Promise<Result<TEntity | null>> {
    try {
      const existing = await this.repository.findOne({ where: filterQuery });

      if (existing) {
        const result = await this.repository.update(filterQuery, document as any);
        if (result.affected === 0) {
          return Result.fail('Unable to update the database', HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const updatedany = await this.repository.findOne({ where: filterQuery });
        const entity = this.mapper.toDomain(updatedany);
        return Result.ok(entity);
      } else {
        const doc = this.repository.create({ ...filterQuery, ...document } as DeepPartial<TModel>);
        const result = await this.repository.save(doc);
        const entity = this.mapper.toDomain(result);
        return Result.ok(entity);
      }
    } catch (error) {
      console.error(error);
      return Result.fail('Unable to upsert the database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteMany(filterQuery: FindOptionsWhere<TModel>): Promise<boolean> {
    try {
      // Check if filterQuery contains In operator (from TypeORM)
      const filterKeys = Object.keys(filterQuery);
      const hasInOperator = filterKeys.some(key => {
        const value = (filterQuery as any)[key];
        return value && typeof value === 'object' && '_type' in value && value._type === 'in';
      });

      let result: DeleteResult;
      if (hasInOperator) {
        // Use QueryBuilder for In operator support
        const queryBuilder = this.repository.createQueryBuilder();
        filterKeys.forEach(key => {
          const value = (filterQuery as any)[key];
          if (value && typeof value === 'object' && '_type' in value && value._type === 'in') {
            queryBuilder.andWhere(`${key} IN (:...${key})`, { [key]: value._value });
          } else {
            queryBuilder.andWhere(`${key} = :${key}`, { [key]: value });
          }
        });
        result = await queryBuilder.delete().execute();
      } else {
        result = await this.repository.delete(filterQuery);
      }
      return result.affected >= 1;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async deleteOne(filterQuery: FindOptionsWhere<TModel>): Promise<boolean> {
    try {
      const result: DeleteResult = await this.repository.delete(filterQuery);
      return result.affected === 1;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async startSession(): Promise<any> {
    // TypeORM doesn't have sessions like MongoDB
    // This would need to be implemented using transactions
    throw new Error('Sessions not implemented for TypeORM - use transactions instead');
  }

  async insertMany(docs: DeepPartial<TModel>[]): Promise<Result<TEntity[]>> {
    try {
      const documentsToSave = docs.map((doc) => this.repository.create(doc));
      const documents = await this.repository.save(documentsToSave);
      if (!documents?.length) {
        throwApplicationError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unable to insert documents into the database');
      }
      const entities: TEntity[] = documents.map((doc) => this.mapper.toDomain(doc));
      return Result.ok(entities);
    } catch (error) {
      console.error(error);
      return Result.fail('Unable to insert documents into the database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async insertManyWithSession(docs: DeepPartial<TModel>[]): Promise<Result<string[]>> {
    try {
      const documentsToSave = docs.map((doc) => this.repository.create(doc));
      const documents = await this.repository.save(documentsToSave);
      if (!documents?.length) {
        throwApplicationError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unable to insert documents into the database');
      }
      const documentIds: string[] = documents.map((doc) => (doc as any).id);
      return Result.ok(documentIds);
    } catch (error) {
      console.error(error);
      return Result.fail('Unable to insert documents into the database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateOne(filter: FindOptionsWhere<TModel>, query: DeepPartial<TModel>): Promise<Result<TEntity>> {
    try {
      console.log('[GenericTypeOrmRepository] updateOne filter:', JSON.stringify(filter));
      console.log('[GenericTypeOrmRepository] updateOne query:', JSON.stringify(query));

      const result: UpdateResult = await this.repository.update(filter, query as any);
      if (result.affected === 0) {
        throwApplicationError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unable to update document in the database');
      }

      const updatedany = await this.repository.findOne({ where: filter });
      if (!updatedany) {
        throwApplicationError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unable to find updated document');
      }

      const entity: TEntity = this.mapper.toDomain(updatedany);
      return Result.ok(entity);
    } catch (error) {
      console.error('[GenericTypeOrmRepository] updateOne error:', error);
      console.error('[GenericTypeOrmRepository] updateOne error stack:', error.stack);
      return Result.fail('Unable to update document in the database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateMany(
    query: FindOptionsWhere<TModel>,
    updateBody: DeepPartial<TModel>,
  ): Promise<Result<TEntity[]>> {
    try {
      const result: UpdateResult = await this.repository.update(query, updateBody as any);
      if (result.affected < 1) {
        throwApplicationError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unable to update documents in the database');
      }

      const updatedanys = await this.repository.find({ where: query });
      const entities: TEntity[] = updatedanys.map((doc) => this.mapper.toDomain(doc));
      return Result.ok(entities);
    } catch (error) {
      console.error(error);
      return Result.fail('Unable to update documents in the database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
