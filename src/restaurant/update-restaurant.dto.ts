import { PartialType } from '@nestjs/swagger';
import { CreateRestaurantDTO } from './create-restaurant.dto';

export class UpdateRestaurantDTO extends PartialType(CreateRestaurantDTO) {}
