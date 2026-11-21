import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
export class OrderItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) @Max(20) quantity!: number;
}
export class CreateOrderDto {
  @IsUUID() requestId!: string;
  @IsString() @Matches(/\S/) @Length(2, 100) customerName!: string;
  @IsEmail() @Length(3, 254) email!: string;
  @IsString() @Matches(/^\+?[0-9() \-]{7,25}$/) phone!: string;
  @IsString() @Matches(/\S/) @Length(10, 500) address!: string;
  @IsOptional() @IsString() @Length(0, 1000) comment?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
