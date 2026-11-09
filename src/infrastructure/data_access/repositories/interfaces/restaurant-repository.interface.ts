
import { Restaurant } from '../../../../restaurant/restaurant';
import { IGenericTypeOrmRepository } from '../../../database/typeorm/generic-typeorm.interface';
import { Restaurant as RestaurantEntity } from '../../../database/entities/restaurant.entity';
import { PaginationResponse } from '../../../../shared/dto/enhanced-pagination.dto';

export interface IRestaurantRepository extends IGenericTypeOrmRepository<Restaurant, RestaurantEntity> {
  getRestaurant(restaurantId: string): Promise<Restaurant>;
  getRestaurants(): Promise<Restaurant[]>;
  getRestaurantsWithFilters(filters: any): Promise<PaginationResponse<Restaurant>>;
}
