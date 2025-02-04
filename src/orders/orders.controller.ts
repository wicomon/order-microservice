import { Controller, NotImplementedException, ParseUUIDPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto, OrderPaginationDto, ChangeOrderStatusDto, PaidOrderDto } from './dto';


@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern('createOrder')
  async create(@Payload() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.create(createOrderDto);

    const paymentSession = await this.ordersService.createPaymentSession(order)

    return {
      order,
      paymentSession
    }

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

  @EventPattern('payment.succeeded')
  paidOrder(
    @Payload() paidOrderDto: PaidOrderDto
  ){
    // console.log({paidOrderDto}) 
    return this.ordersService.paidOrder(paidOrderDto);
  }
}