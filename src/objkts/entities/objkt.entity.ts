import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Objkt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  creator_alias: string;

  @Column()
  creator_address: string;

  @Column()
  royalty: number;

  @Column()
  editions: number;

  @Column()
  owned: number;

  @Column()
  mint_date: Date;

  @Column()
  list_date: Date;

  @Column()
  token_id: number;

  @Column()
  contract: string;

  @Column()
  price: number;

  @Column({ default: null })
  secondary_price: number;

  @Column()
  address: string;

  @Column()
  artwork: string;

  @Column()
  market_place: string;

  @Column()
  collect_rate: number;

  @Column()
  sold_rate: number;
}
