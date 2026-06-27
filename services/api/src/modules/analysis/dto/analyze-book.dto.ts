import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ProviderConfigDto } from "@/modules/ai-provider/dto/provider-config.dto";

export class AnalyzeBookDto {
  @ApiProperty({ type: ProviderConfigDto })
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  provider!: ProviderConfigDto;

  @ApiProperty({
    description: "Book title for the asset report.",
    example: "示例长篇小说",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    description: "Genre used to frame the book-level analysis.",
    enum: [
      "xuanhuan",
      "urban",
      "romance",
      "suspense",
      "infinite-flow",
      "other",
    ],
    example: "xuanhuan",
  })
  @IsIn(["xuanhuan", "urban", "romance", "suspense", "infinite-flow", "other"])
  genre!: string;

  @ApiProperty({
    description:
      "Full or partial novel text. MVP is synchronous; keep samples moderate.",
  })
  @IsString()
  @MinLength(500)
  @MaxLength(500000)
  text!: string;
}
