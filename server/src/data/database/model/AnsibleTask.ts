import { Schema, model } from 'mongoose';

export const DOCUMENT_NAME = 'AnsibleTask';
export const COLLECTION_NAME = 'ansibletasks';

export default interface AnsibleTask {
  ident: string;
  status?: string;
  cmd?: string;
  target?: string[];
  createdAt?: string;
}

const schema = new Schema<AnsibleTask>(
  {
    ident: {
      type: Schema.Types.String,
      required: true,
      unique: true,
    },
    status: {
      type: Schema.Types.String,
      required: true,
    },
    cmd: {
      type: Schema.Types.String,
      required: true,
    },
    target: {
      type: Schema.Types.Array,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const AnsibleTaskModel = model<AnsibleTask>(DOCUMENT_NAME, schema, COLLECTION_NAME);
