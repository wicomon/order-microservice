import { Controller, NotImplementedException, ParseUUIDPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto, OrderPaginationDto, ChangeOrderStatusDto } from './dto';


@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern('createOrder')
  create(@Payload() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @MessagePattern('findAllOrders')
  findAll(
    @Payload() orderPaginationDto: OrderPaginationDto,
  ) {
    return this.ordersService.findAll(orderPaginationDto);
  }

  @MessagePattern('findOneOrder')
  findOne(@Payload('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @MessagePattern('changeOrderStatus')
  changeOrderStatus(
    @Payload() changeOrderStatusDto: ChangeOrderStatusDto
  ){
    // console.log({changeOrderStatusDto})
    // return changeOrderStatusDto;
    return this.ordersService.changeOrderStatus(changeOrderStatusDto);
  }
}