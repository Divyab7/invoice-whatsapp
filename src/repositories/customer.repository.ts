import { ClientSession, Types } from 'mongoose';
import { CustomerModel, CustomerDocument } from '../models/Customer';

export class CustomerRepository {
  async findByNameCaseInsensitive(
    businessId: Types.ObjectId,
    name: string,
    session?: ClientSession,
  ): Promise<CustomerDocument | null> {
    return CustomerModel.findOne({
      business: businessId,
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    }).session(session ?? null);
  }

  async create(
    input: {
      businessId: Types.ObjectId;
      name: string;
      phone?: string;
    },
    session?: ClientSession,
  ): Promise<CustomerDocument> {
    return CustomerModel.create(
      [
        {
          business: input.businessId,
          name: input.name,
          phone: input.phone,
        },
      ],
      { session },
    ).then((docs) => docs[0]!);
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
